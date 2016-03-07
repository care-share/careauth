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
                    //Unhides success message on successful submit
                    $('.success-message').removeAttr('hidden');
                    $('.container.med-list').attr('hidden', 'true');
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
                        <div className='col-xs-3'>
                            Medication Name
                        </div>
                        <div className='col-xs-2'>
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
                            Prescriber
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
            not_found: false,
            freq_array: [],
            alt_hidden: true
        };
    },
    handleChange: function (event) {
        var obj = {};
        var value = event.target.value;
        if (event.target.type === 'checkbox') {
            value = (value === 'false');
        }
        obj[event.target.name] = value;
        this.setState(obj, function(){
            console.log('new value: ' + JSON.stringify(obj));
        });
    },
    handleMedChange: function (event) {
        if (this.state.is_fhir_med === false) { // if not a fhir medication name field then can edit and update state
            var obj = {};
            obj[event.target.name] = event.target.value;
            this.setState(obj);
        }
    },
    freqOnChange: function (freq) {
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
    },
    alternateMedClick: function(){
        var invert = !(this.state.alt_hidden);
        this.setState({
            alt_hidden : invert
        });
    },
    componentDidMount: function () {
        var isFhirMed = true;
        var placeText = 'enter alternative name';
        if (this.props.fhirMedications == '') {
            isFhirMed = false;
            placeText = 'medication name';
        }
        this.setState({
            med_id: this.props.medId,
            order_id: this.props.orderId,
            med_name: this.props.fhirMedications,
            is_fhir_med: isFhirMed,
            placeholder: placeText,
            alt_hidden: isFhirMed
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

        // this does not work because of scope issue
        // $(".js-check").on("change", function(evt) { 
        //     console.debug(this, " fired onChange");
        //     MedEntryInfo.handleChange(evt);
        // });

        //debugger;
        $( this.refs.toggleInput).bootstrapToggle();
        var myMedEntryInfo = this;
        $( this.refs.toggleInput).on("change", function(evt) { 
            //console.log(this, " fired onChange");
            myMedEntryInfo.handleChange(evt);
        });

        $( this.refs.complianceInput).bootstrapToggle();
        var myMedEntryInfo1 = this;
        $( this.refs.complianceInput).on("change", function(evt) { 
            //console.log(this, " fired onChange");
            myMedEntryInfo1.handleChange(evt);
        });
    },
    render: function () {
        // IMPORTANT NOTE: for server-side processing to work correctly, med_name MUST be the first form field!
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
            <div className='row med'>
                <div className='col-xs-3'>
                    <span className='original-med-name'>{this.state.med_name}</span>
                    <div>
                    <input className='form-control col-xs-12' type='hidden' value={this.state.med_name} name='med_name'
                           onChange={this.handleMedChange} />
                    <a onClick={this.alternateMedClick} hidden={!this.state.alt_hidden}>Alternate Name</a>
                    <input className='col-xs-12' type='text' value={this.state.name_sub} name='name_sub'
                           onChange={this.handleChange} placeholder={this.state.placeholder} required
                           style = {{background: 'inherit'}}
                           hidden={this.state.not_found || this.state.alt_hidden} disabled={this.state.not_found || this.state.alt_hidden}/>
                    </div>
                </div>
                <div className='col-xs-2'>
                    <input ref='toggleInput' className='col-xs-12' type='checkbox'defaultChecked data-toggle='toggle' data-on='found' data-off='missing' name='not_found' value={this.state.not_found}
                           hidden={!this.state.is_fhir_med} onChange={this.handleChange}/>
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <input className='col-xs-12' type='text' value={this.state.dose} name='dose' required
                           onChange={this.handleChange} disabled={this.state.not_found} style = {{background: 'inherit'}} />
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <MultiSelect className='col-xs-12' style={{width: '100% !important'}} placeholder='Select freq' options={options}
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
                </div>
                <div className='col-xs-1' hidden={this.state.not_found}>
                    <input ref='complianceInput' className='col-xs-12' type='checkbox' defaultChecked data-toggle='toggle' data-on='yes' data-off='no' name='compliance_bool' value={this.state.compliance_bool}
                           onClick={this.handleChange}/>
                    <textarea className='col-xs-12' type='text' value={this.state.compliance_note} name='noncompliance_note'
                        rows="1" onChange={this.handleChange} placeholder='please expain' hidden={this.state.compliance_bool}/>
                </div>
                <div className='col-xs-1' hidden={this.state.not_found}>
                    <input ref='prescriberInput' className='col-xs-12' type='checkbox' type='checkbox' defaultChecked name='med_bool' value={this.state.med_bool}
                           onClick={this.handleChange} disabled={this.state.not_found}/>
                    <textarea ref='prescriberNote' className='col-xs-12' type='text' value={this.state.prescriber_note} name='prescriber_note'
                        rows="1" onChange={this.handleChange} placeholder='please enter prescriber' hidden={this.state.med_bool}/>
                </div>
                <div className='col-xs-2' hidden={this.state.not_found}>
                    <textarea className='col-xs-12' type='text' name='note' value={this.state.note}
                              rows="1" onChange={this.handleChange} disabled={this.state.not_found}
                              style = {{background: 'inherit'}} />
                </div>
                <input type='hidden' value={this.state.med_id} name='medication_id'/>
                <input type='hidden' value={this.state.order_id} name='medication_order_id'/>
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
