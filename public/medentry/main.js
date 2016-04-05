//Includes React Selectize MultiSelect
//MultiSelect = require('react-selectize').MultiSelect;
var MultiSelect = reactSelectize.MultiSelect;

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
                                medication.medorder = medOrders[j];
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

        //Add Freq validation here

        $('#myform').unbind('submit').bind('submit', function () {
            var frm = $(this).serializeArray();
            for (var i = frm.length - 1; i >= 0; i--) {
                frm[i].name = frm[i].name.split("--")[0]
            }
            var dat = {
                patient_id: getUrlParameter('patient_id'),
                formData: frm
            }; 

            console.log('I am about to POST this:\n\n' + JSON.stringify(dat, null, 2));
            $.ajax({
                type: 'POST',
                url: '/medentries',
                headers: {'X-Auth-Token': token},
                data: JSON.stringify(dat),
                success: function (result) {
                    console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                    //Unhides success message on successful submit
                    $('.success-message').removeAttr('hidden');
                    $('.panel.panel-default').attr('hidden', 'true');
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
        return (
            <form id='myform' onSubmit={this.handleSubmit}>
            <div className='col-sm-12'>
                <div className='panel panel-default'>
                    <div className='panel-heading'>
                        <h2 className='panel-title'>Please enter medications as you find them in the home. 
                                                    This list will be reconciled with VA provider records, 
                                                    and you may be contacted for clarification later.</h2>
                    </div>
                    <table className="table table-hover">
                        <thead>
                        <tr>
                            <th className='col-xs-1'>
                            </th>
                            <th className='col-xs-2'>
                                Medication Name
                            </th>
                            <th className='col-xs-2'>
                                Dosage
                            </th>
                            <th className='col-xs-1'>
                                Frequency
                            </th>
                            <th className='col-xs-2'>
                                Patient Reports Adherence
                            </th>
                            <th className='col-xs-2'>
                                Prescriber
                            </th>
                            <th className='col-xs-2'>
                                Notes
                            </th>
                        </tr>
                        </thead>
                    </table>
                    <table className='table table-striped table-hover'>
                    <tbody>
                        {this.state.allMedications.map(function (medication) {
                            return <MedEntryInfo fhirMedications={medication.text}
                                                 key={medication.id}
                                                 medId={medication.id}
                                                 orderId={medication.orderId}
                                                 medOrder={medication.medorder}
                            />; // display each medication
                        })}
                    </tbody>
                    </table>
                </div>
            </div>
            <div className='panel panel-default'>
                <div className='col-xs-2'>
                    <button className='form-control' onClick={this.handleAdd} hidden={this.state.addHidden}>add
                        new
                    </button>
                </div>
                <div className='col-xs-2'>
                    <button className='form-control submitBtn' onClick={this.handleChanges}>submit list                    
                    </button>
                </div>
                <div className='col-xs-8'></div>
            </div>
            <div hidden className='success-message' name='submit_success'>Submitted Successfully!</div>
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
            compliance_bool: true,
            noncompliance_note: '',
            med_bool: true,
            prescriber_note: '',
            note: '',
            is_fhir_med: false,
            placeholder: '',
            not_found: 'unknown',
            freq_array: [],
            alt_hidden: true,
            doseDiscrepancy: false,
            freqDiscrepancy: false,
            med_order: {}
        };
    },
    handleChange: function (event) {
        this.setState({not_found: false});

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
    handleNotFoundChange: function (event) {
        this.setState({not_found: (event.target.value === 'true')});
    },
    freqOnChange: function (freq) {
        this.setState({not_found: false});

        var result = '';
        for (var i = 0; i < freq.length; i++) {
            if (i !== 0)
                result = result + ',' + freq[i].label;
            else
                result = freq[i].label;
        }

        this.setState({
            freq: result,
            freq_array: freq
        });

        if(result.length == 0){
            this.setState({freqDiscrepancy: false, doseDiscrepancy: false});
        } else{
            this.doseFreqValidation();
        }
    },
    handleOnChange : function (e){
        this.setState({not_found: false});

        var obj = {};
        var value = (e.target.value === 'true')
        var stateName = e.target.name.split('--')[0];
        var that = this;

        obj[stateName] = value;
        this.setState(obj);

        if(that.state.compliance_bool){
            setTimeout(function(){$('#complianceNote' + that.state.med_id).focus();}, 500);
        }

        if(that.state.med_bool){
            setTimeout(function(){$('#prescriberNote' + that.state.med_id).focus();}, 500);
        }

    },
    alternateMedClick: function (){
        this.setState({not_found: false});
        var invert = !(this.state.alt_hidden);
        this.setState({
            alt_hidden : invert
        });
    },
    loadMedPairData: function(event) {
        var patient_id = getUrlParameter('patient_id');
        var token = getUrlParameter('token');

        console.log('requesting medpair discrpency');
        var medentry = {'freq': this.state.freq, 'dose': this.state.dose, 'name': this.state.med_name};
        var medpair = {'medentry': medentry, 'medorder': this.state.med_order};

        // reset states
        this.setState({doseDiscrepancy: false});
        this.setState({freqDiscrepancy: false});

        $.ajax({
            type: 'POST',
            url: '/medpairs/patient_id/' + patient_id,
            data: JSON.stringify(medpair),
            headers: {'X-Auth-Token': token},
            contentType: 'application/json',
            dataType: 'json',
            success: function (result) {
                console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                if(result.data.discrepancy){
                    if(result.data.discrepancy.dose){
                        this.setState({doseDiscrepancy: result.data.discrepancy.dose});
                    }
                    if(result.data.discrepancy.dose == undefined){
                        this.setState({doseDiscrepancy: false});
                    }
                    if(result.data.discrepancy.freq){
                        this.setState({freqDiscrepancy: result.data.discrepancy.freq});
                    } 
                    if(result.data.discrepancy.freq == undefined){
                        this.setState({freqDiscrepancy: false});
                    } 
                    
                }
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(status, err.toString());
            }
        }); 
    },
    componentDidMount: function () {
        var isFhirMed = true;
        var placeText = 'Enter Alternate Name';
        if (this.props.fhirMedications == '') {
            isFhirMed = false;
            placeText = 'Medication Name';
        }
        this.setState({
            med_id: this.props.medId,
            order_id: this.props.orderId,
            med_name: this.props.fhirMedications,
            is_fhir_med: isFhirMed,
            placeholder: placeText,
            alt_hidden: isFhirMed,
            med_order: this.props.medOrder
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

        //This creates the Bootstrap Toggles
        // $('.js-check').bootstrapToggle({
        //     on: 'yes',
        //     off: 'no'
        // });
    },
    doseFreqValidation : function(){
        if(this.state.freq.length == 0){
            this.setState({freqDiscrepancy: false});
        }

        // dose & freq field must be filled out
        if((this.state.dose != '') && (this.state.freq != '')){
            this.loadMedPairData();
        }
    },
    render: function () {
        // IMPORTANT NOTE: for server-side processing to work correctly, not_found MUST be the first form field!
        var self = this,
            options = [
                {label: 'QD', value: 'every day'}, {label: 'QOD', value: 'every other day'},
                {label: 'QAM', value: 'every morning'}, {label: 'QPM', value: 'every afternoon'},
                {label: 'QHS', value: 'every evening'}, {label: 'BID', value: 'two times per day'},
                {label: 'TID', value: 'three times per day'}, {label: 'QID', value: 'four times per day'},
                {label: 'PRN', value: 'as needed'}, {label: 'QW', value: 'every week'},
                {label: 'AC', value: 'with meals'}
            ];
        
        return (
            <tr>
            <td className='col-xs-1'>
                <div className="switch switch-blue">
                    <input id={this.state.med_id + 'found'} className='switch-input' type='radio' name={'not_found--' + this.state.med_id} value='false' 
                        checked={this.state.not_found === false} hidden={!this.state.is_fhir_med} onChange={this.handleNotFoundChange}/>
                    <label htmlFor={this.state.med_id + 'found'} className="switch-label switch-label-off">found</label>
                    <input id={this.state.med_id + 'not_found'} className='switch-input' type='radio' name={'not_found--' + this.state.med_id} value='true' 
                        checked={this.state.not_found === true} hidden={!this.state.is_fhir_med} onChange={this.handleNotFoundChange}/>
                    <label htmlFor={this.state.med_id + 'not_found'} className="switch-label switch-label-on">missing</label>
                    <span className={(this.state.not_found == 'unknown') ? 'hidden' : 'switch-selection'}> </span>
                </div>
            </td>
            <td className='col-xs-2'>
                <span className='original-med-name medNameText'>{this.state.med_name}</span>
                <div>
                    <input className='col-xs-12' type='hidden' value={this.state.med_name} name='med_name'
                        onChange={this.handleMedChange} />
                    <a onClick={this.alternateMedClick} hidden={!this.state.alt_hidden}>Enter Alternate Name</a>
                    <input className='col-xs-12 alternativeName' type='text' value={this.state.name_sub} name='name_sub'
                        onChange={this.handleChange} placeholder={this.state.placeholder} required={this.state.is_fhir_med == false}
                        style = {{background: 'inherit'}} hidden={this.state.alt_hidden || (this.state.isFhirMed)}/>
                </div>
            </td>
            <td className='col-xs-2'>
                <div hidden={this.state.not_found === true}>
                    <input className={'col-xs-12 removePadding ' + ((this.state.doseDiscrepancy == false) ? "valid" : "invalid")} type='text' value={this.state.dose} 
                        name='dose' required onChange={this.handleChange} onBlur={this.doseFreqValidation} style={{background: 'inherit'}} required={this.state.not_found === false}/>
                    <div className='smallerFont' hidden={(this.state.doseDiscrepancy == false) ? true : false}>
                        {'This dosage differs from VA provider records. If more information is available, please explain in the note.'}
                    </div>
                </div>
            </td>
            <td className='col-xs-1'>
            <div hidden={this.state.not_found === true}>
                <MultiSelect refs='freqInput' className='col-xs-12 removePadding' style={{width: '100% !important'}} placeholder='Freq' options={options}
                             onValuesChange={this.freqOnChange}
                             values={this.state.freq_array} theme='bootstrap3'
                             filterOptions={function(options, values, search){
                                /**
                                * filterOptions: method for search elements in options array via value or label
                                * returns an array of option objects to be represented by dropdown
                                *
                                * @param options: array of option objects, each containing a label and value field
                                * passed in from render method of MedEntryInfo
                                * @param values: array of currently selected option objects
                                * passed in from MedEntryInfo state via freq_array
                                * @param search: string of term to be found in options
                                */

                                //Values must be searched with lowSearch, labels must be searched with upSearch
                                var lowSearch = search.toLowerCase();
                                var upSearch = search.toUpperCase();

                                //arrA is an array for holding search terms which match option values
                                //chain goes through options one option obj at a time
                                var arrA = _.chain(options)
                                    //if an option is not present within the option array, reject
                                    .reject(function(option){
                                        return self.state.freq_array.map(function(frequency){
                                            return frequency.label;
                                        }).indexOf(option.label) > -1
                                    })
                                    //if a lowSearch match is found in option, add to return array
                                    .filter(function(option){
                                        return option.value.match(lowSearch) !== null;
                                    })
                                    .first(100)
                                    .value();

                                //arrB is an array for holding search terms which match option labels
                                var arrB = _.chain(options)

                                    .reject(function(option){
                                        return self.state.freq_array.map(function(frequency){
                                            return frequency.value;
                                        }).indexOf(option.value) > -1
                                    })
                                    .filter(function(option){
                                        return option.label.indexOf(upSearch) == 0;
                                    })
                                    .first(100)
                                    .value();
                                //if arrA has any elements in it, return arrA else return arrB
                                if (arrA.length > 0)
                                    return arrA;
                                else
                                    return arrB;
                             }}

                             renderOption={function(item){
                             return <div>
                                <span style={{marginRight: 4, verticalAlign: 'middle', width: 24, fontWeight: 'bold'}}>{item.label}</span>
                                <span>{item.value}</span>
                             </div>
                             }}

                />
                <input type='text' value={this.state.freq} name='freq' hidden />
                <div className='smallerFont' hidden={(this.state.freqDiscrepancy == false) ? true : false}>{'This frequency differs from VA provider records. If more information is available, please explain in the note.'}</div>
            </div>
            </td>
            <td className='col-xs-2'>
                <div hidden={this.state.not_found === true}>
                    <div className="switch switch-blue">
                        <input id={this.state.med_id + 'yes'} className='switch-input' type='radio' name={'compliance_bool--' + this.state.med_id} value='true' 
                            checked={this.state.compliance_bool === true} hidden={!this.state.is_fhir_med} onChange={this.handleOnChange}/>
                        <label htmlFor={this.state.med_id + 'yes'} className="switch-label switch-label-off">yes</label>
                        <input id={this.state.med_id + 'no'} className='switch-input' type='radio' name={'compliance_bool--' + this.state.med_id} value='false' 
                            checked={this.state.compliance_bool === false} hidden={!this.state.is_fhir_med} onChange={this.handleOnChange}/>
                        <label htmlFor={this.state.med_id + 'no'} className="switch-label switch-label-on">no</label>
                        <span className='switch-selection'> </span>
                    </div>              
                    <textarea id={'complianceNote' + this.state.med_id} className='col-xs-12 removePadding' type='text' value={this.state.compliance_note} name='noncompliance_note'
                        rows="1" onChange={this.handleChange} placeholder='please expain' hidden={this.state.compliance_bool}></textarea>
                </div>
            </td>
            <td className='col-xs-2' hidden={this.state.not_found === true}>
                <div hidden={this.state.not_found === true}>
                    <div className="switch switch-blue">
                        <input id={this.state.med_id + 'VA'} className='switch-input' type='radio' name={'med_bool--' + this.state.med_id} value='true' 
                            checked={this.state.med_bool === true} hidden={!this.state.is_fhir_med} onChange={this.handleOnChange}/>
                        <label htmlFor={this.state.med_id + 'VA'} className="switch-label switch-label-off">VA</label>
                        <input id={this.state.med_id + 'other'} className='switch-input' type='radio' name={'med_bool--' + this.state.med_id} value='false' 
                            checked={this.state.med_bool === false} hidden={!this.state.is_fhir_med} onChange={this.handleOnChange}/>
                        <label htmlFor={this.state.med_id + 'other'} className="switch-label switch-label-on">other</label>
                        <span className='switch-selection'> </span>
                    </div> 
                    <textarea id={'prescriberNote' + this.state.med_id} className='col-xs-12 removePadding' type='text' value={this.state.prescriber_note} name='prescriber_note'
                        rows="1" onChange={this.handleChange} placeholder='please enter prescriber' hidden={this.state.med_bool}></textarea>                 
                </div>
            </td>
            <td className='col-xs-2' hidden={this.state.not_found === true}>
                <div>
                    <textarea className='col-xs-12 removePadding' type='text' name='note' value={this.state.note}
                        rows="1" onChange={this.handleChange} style = {{background: 'inherit'}} />
                </div>
            </td>
            <input type='hidden' value={this.state.med_id} name='medication_id'/>
            <input type='hidden' value={this.state.order_id} name='medication_order_id'/>
            </tr>
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
