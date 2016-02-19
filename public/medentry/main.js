function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
}

var ViewPage = React.createClass({
    getInitialState: function () {
        return {
            medication_list_response: []
        };
    },
    loadDataFromServer: function () {
        // the page expects two URL parameters: 'token' and 'patient_id'
        // e.g. the URL should look like this in the browser:
        //   http://api.domain:3000/medentry?token=abc&patient_id=xyz
        var token = getUrlParameter('token');
        var patient_id = getUrlParameter('patient_id');
        // TODO: validate that token and patient_id are not null
        var fhir_url_base = window.location.origin.replace('api.', 'fhir.');
        var fhir_url = fhir_url_base + '/MedicationOrder?_include=MedicationOrder:medication&_format=json&_count=50&patient=' + patient_id;

        $.ajax({
            url: fhir_url,
            dataType: 'json',
            type: 'GET',
            headers: {'X-Auth-Token': token},
            success: function (result) {
                //console.log(JSON.stringify(result.entry[0]));
                var state = this.state.medication_list_response; // array
                var map = {};
                var medOrders = [];
                for (var i = 0; i < result.entry.length; i++) {
                    var resType = result.entry[i].resource.resourceType;
                    if (resType === 'Medication') {
                        var id = result.entry[i].resource.id;
                        var text = result.entry[i].resource.code.text;
                        state[i] = {id: id, text: text};
                        map[id] = i;
                    } else if (resType === 'MedicationOrder') {
                        medOrders.push(result.entry[i].resource);
                    }
                }
                // loop through MedicationOrder resources and set the orderId for each medication
                for (var j = 0; j < medOrders.length; j++) {
                    if (medOrders[j].medicationReference) {
                        var ref = medOrders[j].medicationReference.reference;
                        if (ref) {
                            var medicationId = ref.split('/')[1];
                            var medication = state[map[medicationId]];
                            if (medication) {
                                medication.orderId = medOrders[j].id;
                            }
                        }
                    }
                }
                this.setState(state);
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(this.props.source, status, err.toString());
            }.bind(this)
        });
    },
    componentDidMount: function () {
        this.loadDataFromServer();
    },
    render: function () {
        var token = getUrlParameter('token');
        return (
            <div>
                <MedEntryInfoList
                    fhirMedications={this.state.medication_list_response} token={token}
                />
            </div>
        )
    }
});

var MedEntryInfoList = React.createClass({
    getInitialState: function () {
        return {
            allMedications: [],
            id: 10000000,
            addHidden: false,
            submitHidden: false
        };
    },
    handleAdd: function () {
        // changed state of allMedications, append empty MedEntryInfo item
        var newMed = this.state.allMedications;
        newMed.push({id: new Date().getTime() + '-' + this.state.id, text: ''});
        var newId = this.state.id;
        this.setState({id: newId++});
        this.setState({allMedications: newMed});
        // render function should display updated allMedications list
    },
    handleSubmit: function (e) {
        e.preventDefault();
    },
    handleChanges: function (e) {
        var token = this.props.token;
        console.log('Should put data into mongoDB');
        //If name_sub exists, replace name

        $('#myform').unbind('submit').bind('submit', function () {
            var frm = $(this);
            var dat = {
                patient_id: getUrlParameter('patient_id'),
                formData: frm.serializeArray()
            };

            console.log('I am about to POST this:\n\n' + JSON.stringify(dat, null, 2));
            $.ajax({
                type: 'POST',
                url: '/medentries',
                headers: {'X-Auth-Token': token},
                data: JSON.stringify(dat),
                success: function (result) {
                    console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        });
    },
    componentDidMount: function () {
        this.setState({allMedications: this.props.fhirMedications});
    },
    render: function () {
        console.log(this.state.allMedications);
        return (
            <form id='myform' onSubmit={this.handleSubmit}>
                <div className='container med-list'>
                    <h2 className='title'>Verify patient medication list:</h2>
                    <div className='row header'>
                        <div className='col-xs-2'>
                            Medication Name
                        </div>
                        <div className='col-xs-1'>
                            Not Found
                        </div>
                        <div className='col-xs-2'>
                            Dosage
                        </div>
                        <div className='col-xs-2'>
                            Frequency
                        </div>
                        <div className='col-xs-1'>
                            Patient Reports Compliance:
                        </div>
                        <div className='col-xs-1'>
                            Non VA Med
                        </div>
                        <div className='col-xs-2'>
                            Notes
                        </div>
                    </div>

                    {this.state.allMedications.map(function (medication) {
                        return <MedEntryInfo fhirMedications={medication.text}
                                             key={medication.id}
                                             medId={medication.id}
                                             orderId={medication.orderId}
                        />; // display each medication
                    })}
                    <div className='row buttons'>
                        <div className='col-xs-8'></div>
                        <div className='col-xs-2'>
                            <button className='form-control' onClick={this.handleAdd} hidden={this.state.addHidden}>add
                                new
                            </button>
                        </div>
                        <div className='col-xs-2'>
                            <button className='form-control' onClick={this.handleChanges}
                                    hidden={this.state.submitHidden}>submit changes
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        );
    }
});

//TODO add hidden FHIR id value to POST when submitting

var MedEntryInfo = React.createClass({
    getInitialState: function () {
        return {
            med_id: '', // FHIR ID of this Medication (if applicable)
            order_id: '', // FHIR ID of the MedicationOrder that references this Medication (if applicable)
            med_name: '',
            name_sub: '',
            dose: '',
            freq: '',
            compliance_bool: false,
            med_bool: false,
            note: '',
            is_fhir_med: false,
            placeholder: '',
            not_found: false
        };
    },
    handleChange: function (event) {
        var obj = {};
        var value = event.target.value;
        if (event.target.type === 'checkbox') {
            value = (value === 'false');
        }
        obj[event.target.name] = value;
        this.setState(obj);
    },
    handleMedChange: function (event) {
        if (this.state.is_fhir_med === false) { // if not a fhir medication name field then can edit and update state
            var obj = {};
            obj[event.target.name] = event.target.value;
            this.setState(obj);
        }
    },
    componentDidMount: function () {
        var isFhirMed = true;
        var placeText = 'alternative name';
        if (this.props.fhirMedications == '') {
            isFhirMed = false;
            placeText = 'medication name';
        }
        this.setState({
            med_id: this.props.medId,
            order_id: this.props.orderId,
            med_name: this.props.fhirMedications,
            is_fhir_med: isFhirMed,
            placeholder: placeText
        });
        //This creates the Bootstrap Toggles
        $('.js-check').bootstrapToggle({
            on: 'yes',
            off: 'no'
        });
        //This creates the Select2 form
        //QD    every day
        //QOD    every other day
        //QAM    every morning
        //QPM    every afternoon
        //QHS    every evening
        //BID    twice per day
        //TID    three times per day
        //QID    four times per day
        //PRN    as needed
        //QW    every week
        //Q[digit]H    every x hours
        //AC    with meals

        //var data = [{id: 0, text: 'QD'},{id: 1, text: 'QOD'},{id: 2, text: 'QAM'},{id: 3, text: 'QPM'},{id: 4, text: 'QHS'},
        //                {id: 5, text: 'BID'},{id: 6, text: 'TID'},{id: 7, text: 'QID'},{id: 8, text: 'PRN'},
        //                {id: 9, text: 'QW'},{id: 10, text: 'AC'}];
        //$('.js-select-multiple').select2({
        //    data: data
        //});

    },
    render: function () {
        // IMPORTANT NOTE: for server-side processing to work correctly, med_name MUST be the first form field!
        return (
            <div className='row med'>
                <div className='col-xs-2'>
                    <span className='original-med-name'>{this.state.med_name}</span>
                    <input className='form-control col-xs-12' type='hidden' value={this.state.med_name} name='med_name'
                           onChange={this.handleMedChange}/>
                    <input className='col-xs-12' type='text' value={this.state.name_sub} name='name_sub'
                           onChange={this.handleChange} placeholder={this.state.placeholder}
                           hidden={this.state.not_found} disabled={this.state.not_found}/>
                </div>
                <div className='col-xs-1'>
                    <input className='col-xs-12' type='checkbox' name='not_found' value={this.state.not_found}
                           hidden={!this.state.is_fhir_med} onClick={this.handleChange}/>
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <input className='col-xs-12' type='text' value={this.state.dose} name='dose'
                           onChange={this.handleChange} disabled={this.state.not_found}/>
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <input className='col-xs-12' type='text' value={this.state.freq} name='freq'
                           onChange={this.handleChange} disabled={this.state.not_found}/>
                </div>
                <div className='col-xs-1' hidden={this.state.not_found}>
                    <input className='col-xs-12 js-check' type='checkbox' name='compliance_bool' value='true'
                           onClick={this.handleChange}/>
                </div>
                <div className='col-xs-1' hidden={this.state.not_found}>
                    <input className='col-xs-12 js-check' type='checkbox' name='med_bool' value='true'
                           onClick={this.handleChange} disabled={this.state.not_found}/>
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <textarea className='col-xs-12' type='text' name='note' value={this.state.note}
                              rows="1" onChange={this.handleChange} disabled={this.state.not_found}/>
                </div>
                <input type='hidden' value={this.state.med_id} name='medication_id'/>
                <input type='hidden' value={this.state.order_id} name='medication_order_id'/>
                <div type='hidden' value='Submitted successfully!' name='submit_success'></div>
            </div>
        );
    }
});

/**
 * Renders the entire page
 * Places DOM within 'content' <div> on index.html
 */
ReactDOM.render(
    <ViewPage/>,
    document.getElementById('content')
);
