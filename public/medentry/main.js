//Includes React Selectize MultiSelect
//MultiSelect = require('react-selectize').MultiSelect;
var SimpleSelect = reactSelectize.SimpleSelect;
var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;
var Overlay = ReactBootstrap.Overlay;

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
        // use this patient_id: 1460474212557-666-66-6666
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
                        state[i] = {id: id, text: text, completed: false};
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
                <MedEntryInfoList fhirMedications={this.state.medication_list_response} token={token} />
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
            submitHidden: false,
            disable_submit: true
        };
    },
    handleAdd: function () {
        // changed state of allMedications, append empty MedEntryInfo item
        var newMed = this.state.allMedications;
        newMed.push({id: new Date().getTime() + '-' + this.state.id, text: '', completed: false});
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

        //Check if each node can be submitted.
        //If node is empty, prevent submit and highlight
        //Else check next node

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
    orderMedAscending: function () {
        var allMeds = this.state.allMedications;

        allMeds.sort(function (a, b) {
            if (a.text > b.text) {
                return 1;
            }
            if (a.text < b.text) {
                return -1;
            }

            return 0;
        });

        this.setState({allMedications: allMeds});
    },
    orderMedDescending: function () {
        var allMeds = this.state.allMedications;

        allMeds.sort(function (a, b) {
            if (a.text < b.text) {
                return 1;
            }
            if (a.text > b.text) {
                return -1;
            }

            return 0;
        });

        this.setState({allMedications: allMeds});
    },
    componentDidMount: function () {
        this.setState({allMedications: this.props.fhirMedications});
    },
    handleDiscrepancy: function (status) {
        this.setState({is_discrepancy: status});
    },
    handleComplete: function (medid, status) {
        var state = this.state.allMedications;
        console.log('Searching for medid of ' + medid);
        var loc = state.map(function (x) {
            return x.id
        }).indexOf(medid);
        console.log(loc);
        if (loc !== -1) {
            state[loc].completed = status;
        }
        this.setState({allMedications: state});
        for (var it = 0; it < state.length; it++) {
            if (state[it] !== undefined) {
                console.log(state[it]);
                if (state[it].completed === false) {
                    this.setState({disable_submit: true});
                    break;
                }
                if (it === state.length - 1) {
                    this.setState({disable_submit: false});
                }
            }
        }
    },
    render: function () {
        var self = this;
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
                                    <div className="order pull-left">
                                        <a className="asc" onClick={this.orderMedAscending}>&uarr;</a>
                                        <a className="desc" onClick={this.orderMedDescending}>&darr;</a>
                                    </div>
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
                            <tbody style={{'height': '600px', 'overflow':'scroll', 'display': 'block'}}>
                            {this.state.allMedications.map(function (medication) {
                                return <MedEntryInfo fhirMedications={medication.text}
                                                     key={medication.id}
                                                     medId={medication.id}
                                                     orderId={medication.orderId}
                                                     medOrder={medication.medorder}
                                                     handleComplete={self.handleComplete}
                                                     handleDiscrepancy={self.handleDiscrepancy}
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
                    <div className='col-xs-7'></div>
                    <div className='col-xs-1'>Please complete the form to submit</div>
                    <div className='col-xs-2'>
                        <button className='form-control submitBtn' disabled={this.state.disable_submit}
                                onClick={this.handleChanges}>submit list
                        </button>
                    </div>
                </div>
                <div hidden className='success-message' name='submit_success'>Submitted Successfully!</div>
            </form>
        );
    }
});

var MedEntryInfo = React.createClass({
    getInitialState: function () {
        return {
            med_id: '', // FHIR ID of this Medication (if applicable)
            order_id: '', // FHIR ID of the MedicationOrder that references this Medication (if applicable)
            med_name: '',
            name_sub: '',
            dose: '',
            ehr_dose: '',
            freq: '',
            ehr_freq: '',
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
            hideload: true,
            med_order: {},
            click_alt: true,
            row_discrepancy: false //Indicates whether or not this medication has a un-addressed discrepancy
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

        if(event.target.name === 'note'){
            //if value === '' then check if discrepancy. If so, indicate unaddressed discrepancy
            if(this.state.row_discrepancy) {
                if (value === '') {
                    this.addRowDisc();
                } else {
                    this.removeRowDisc();
                }
            }
        }
    },
    handleMedChange: function (event) {
        if (this.state.is_fhir_med === false) { // if not a fhir medication name field then can edit and update state
            var obj = {};
            obj[event.target.name] = event.target.value;
            this.setState(obj);
        }
    },
    /**
     * handleNotFoundChange
     * indicates whether or not this medication is present within the home
     * event.target.value === true ; indicates that medication is MISSING
     * else ; indicates that row is FOUND
     */
    handleNotFoundChange: function (event) {
        var inv = !this.state.click_alt;
        this.setState({
            not_found: (event.target.value === 'true'),
            doseDiscrepancy: false,
            freqDiscrepancy: false,
            click_alt: (event.target.value === 'false'),
            alt_hidden: true
        });
        //If medication is missing, remove row highlighting and indicate to parent this is ready to submit
        if ((event.target.value === 'true')) {
            this.removeRowDisc();
            this.props.handleComplete(this.state.med_id, true);
        }
        //If medication is found, check if discrepancy exists. If discrepancy does exist, check if note exists.
        else {
            if(this.state.dose && this.state.freq)
                this.props.handleComplete(this.state.med_id, true);
            else
                this.props.handleComplete(this.state.med_id, false);

            //Check if there is an unaddressed discrepancy for this medication
            if(this.state.row_discrepancy){
                //Check if the discrepancy has been addressed via note
                if(this.state.note !== ''){
                    this.props.handleComplete(this.state.med_id, true);
                    this.removeRowDisc();
                }
                //Otherwise discrepancy has not been addressed, restore highlighting / discrepancy
                else {
                    this.addRowDisc();
                }
            }
        }
    },
    addRowDisc: function() {
        this.props.handleDiscrepancy(true);
        $('#' + this.state.med_id).addClass('med_row');
    },
    removeRowDisc: function() {
        this.props.handleDiscrepancy(false);
        $('#' + this.state.med_id).removeClass('med_row');
    },
    handleOnChange: function (e) {
        this.setState({not_found: false});

        var obj = {};
        var value = (e.target.value === 'true');
        var stateName = e.target.name.split('--')[0];
        var that = this;

        obj[stateName] = value;
        this.setState(obj);

        if (that.state.compliance_bool) {
            setTimeout(function () {
                $('#complianceNote' + that.state.med_id).focus();
            }, 500);
        }

        if (that.state.med_bool) {
            setTimeout(function () {
                $('#prescriberNote' + that.state.med_id).focus();
            }, 500);
        }

    },
    alternateMedClick: function () {
        this.setState({not_found: false});
        var invert = !(this.state.alt_hidden);
        this.setState({
            click_alt: invert,
            alt_hidden: invert
        });
        console.log(invert);
        console.log(this.state.is_fhir_med);
    },
    displayText: function (obj) { // spelled out summary of the repeat pattern
        var frequency = obj['frequency'];
        var frequencyMax = obj['frequencyMax'];
        var period = obj['period'];
        var periodMax = obj['periodMax'];
        var periodUnits = obj['periodUnits'];
        //var when = this.get('when');
        var string = null;
        //if (!frequency && !period) {
        if (!frequency || !period || !periodUnits) {
            string = 'None specified';
        } else {
            string = frequency.toString();
            if (frequencyMax) {
                string = string + '-' + frequencyMax.toString();
            }
            string = string + ' times every ';
            string = string + period.toString();
            if (periodMax) {
                string = string + '-' + periodMax.toString();
            }
            string = string + ' ' + periodUnits.toUpperCase();
        }
        return string;
        //}.property('frequency', 'frequencyMax', 'period', 'periodMax', 'when'),
    },
    displayCode: function (obj) { // short code of the repeat pattern, falls back to displayText if it's not encodable
        var self = this;
        var frequency = (obj['frequency'] ? obj['frequency'] : null);
        var frequencyMax = (obj['frequencyMax'] ? obj['frequencyMax'] : null);
        var period = (obj['period'] ? obj['period'] : null);
        var periodMax = (obj['periodMax'] ? obj['periodMax'] : null);
        var periodUnits = (obj['periodUnits'] ? obj['periodUnits'] : null);
        //var when = this.get('when');
        var encodedPattern = frequency + ' ' + frequencyMax + ' ' + period + ' ' + periodMax + ' ' + periodUnits;
        console.log(encodedPattern);

        // FIXME: don't use a "truthy" comparison (use ===)
        if (!frequency || (frequency == 1 && !frequencyMax)) {
            if (period) {
                // frequency is 1 or not set, but we have a period.
                // construct a period-based code.
                var encodedPeriod;
                if (periodMax) {
                    // range period
                    encodedPeriod = period.toString() + '-' + periodMax.toString();
                } else {
                    switch (period) {
                        case 1: // e.g. QD
                            encodedPeriod = '';
                            break;
                        case 2: // e.g. QOW
                            encodedPeriod = 'O';
                            break;
                        default: // e.g. Q6H
                            encodedPeriod = period.toString();
                    }
                }
                encodedPattern = 'Q' + encodedPeriod;
            }
            // FIXME: don't use a "truthy" comparison (use ===)
        } else if (!period || (period == 1 && !periodMax)) {
            if (frequency) {
                // period is 1 or not set, but we have a frequency.
                // construct a frequency-based code.
                var encodedFrequency;
                if (frequencyMax) {
                    // range frequency
                    encodedFrequency = frequency.toString() + '-' + frequencyMax.toString();
                } else {
                    switch (frequency) {
                        case 1:
                            // We should never end up here! should be covered in the period-based codes
                            break;
                        case 2: // e.g. BID, BIW
                            encodedFrequency = 'B';
                            break;
                        case 3: // e.g. TID, TIW
                            encodedFrequency = 'T';
                            break;
                        case 4:
                            encodedFrequency = 'Q';
                            break;
                        default:
                            encodedFrequency = frequency.toString();
                    }
                }
                encodedPattern = encodedFrequency + 'I';
            }
        }

        if (encodedPattern && periodUnits) { // either we've figured out a way to encode this
            return (encodedPattern + periodUnits).toUpperCase();
        } else { // or we fall back to the verbose version
            return self.displayText(frequency, frequencyMax, period, periodMax, periodUnits);
        }
    },
    loadMedPairData: function (event) {
        var patient_id = getUrlParameter('patient_id');
        var token = getUrlParameter('token');

        console.log('requesting medpair discrepency');
        var medentry = {'freq': this.state.freq, 'dose': this.state.dose, 'name': this.state.med_name};
        var medpair = {'medentry': medentry, 'medorder': this.state.med_order};

        // reset states
        this.setState({doseDiscrepancy: false, freqDiscrepancy: false, hideload: false});

        var self = this;

        function finish() {
            self.setState({hideload: true});
        }

        $.ajax({
            type: 'POST',
            url: '/medpairs/patient_id/' + patient_id,
            data: JSON.stringify(medpair),
            headers: {'X-Auth-Token': token},
            contentType: 'application/json',
            dataType: 'json',
            success: function (result) {
                console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                //Checks to see if there is a discrepancy response
                if (result.data.discrepancy) {

                    //Checks to see if dosage has a discrepancy
                    //TODO: See if dosage got fixed, currently doesn't check unless using a specific format (problem with Transcript API)
                    if (result.data.discrepancy.dose) {
                        this.setState({
                                doseDiscrepancy: result.data.discrepancy.dose,
                                ehr_dose: result.data.ehrMed.dosageInstruction[0].doseQuantity.value
                                + ' ' + result.data.ehrMed.dosageInstruction[0].doseQuantity.unit
                            },
                            function () {
                                console.log(this.state.ehrMed);
                            });
                    }

                    //If undefined, set states to none
                    if (result.data.discrepancy.dose == undefined) {
                        this.setState({
                            doseDiscrepancy: false,
                            ehr_dose: ''
                        });
                    }

                    //Checks to see if frequency has a discrepancy
                    if (result.data.discrepancy.freq) {
                        var ehrfreq = self.displayCode(result.data.ehrMed.dosageInstruction[0].timing.repeat);
                        console.log(ehrfreq);
                        this.setState({freqDiscrepancy: result.data.discrepancy.freq, ehr_freq: ehrfreq});
                    }

                    //If undefined, set states to none
                    if (result.data.discrepancy.freq == undefined) {
                        this.setState({freqDiscrepancy: false, ehr_freq: ''});
                    }

                    //When done, check both states. if either one is true, set row discrepancy to true
                    //If false, set row discrepancy to false
                    if (this.state.freqDiscrepancy || this.state.doseDiscrepancy){
                        //Set row discrepancy to true
                        //Set color of row to yellow
                        //Indicate to parent there is discrepancy
                        this.setState({row_discrepancy: true}, this.addRowDisc);
                    } else {
                        //Set row discrepancy to false
                        //Remove yellow color
                        //Indicate to parent there is no discrepancy
                        this.setState({row_discrepancy: false}, this.removeRowDisc);
                    }
                    finish();
                }
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(status, err.toString());
                finish();
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
    },
    doseFreqValidation: function () {

        console.log('Dose Freq Validation called');
        console.log('Current frequency is: ' + this.state.freq);

        //Check the state of freq. If empty, indicate it needs to be filled out via highlighting

        if (this.state.freq.length == 0) {
            //Freq is empty, need to indicate it must be filled out AND prevent submit until it is cleared up
            //1. Set certain state to indicate that Freq can't be submitted
            //
            this.setState({freqDiscrepancy: false});
        }


        // dose & freq field must be filled out
        if ((this.state.dose != '') && (this.state.freq != '')) {
            console.log('Calls loadMedPairData');
            this.loadMedPairData();
            this.props.handleComplete(this.state.med_id,true);
        } else {
            this.props.handleComplete(this.state.med_id,false);
        }
    },
    flipDose: function () {
        this.setState({doseDiscrepancy: false});
    },
    flipFreq: function () {
        this.setState({freqDiscrepancy: false});
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

        var doseTooltip = (<Tooltip id={this.state.med_id}>
            <a style={{position: 'absolute',top: '0px',right: '16px',fontSize:'large',cursor:'pointer'}}
               onClick={this.flipDose}>x</a>
            <br/>
            <strong>This dosage differs from VA provider records. Did you meant {this.state.ehr_dose}? If more
                information is available, please explain in the note.</strong>
        </Tooltip>);

        var freqTooltip = (<Tooltip id={this.state.med_id}>
            <a style={{position: 'absolute',top: '0px',right: '16px',fontSize:'large',cursor:'pointer'}}
               onClick={this.flipFreq}>x</a>
            <br/>
            <strong>This frequency differs from VA provider records. Did you meant {this.state.ehr_freq}? If more
                information is available, please explain in the note.</strong>
        </Tooltip>);

        return (
            <tr id={this.state.med_id}>
                <td className='col-xs-1'>
                    <div className="switch switch-blue">
                        <input id={this.state.med_id + 'found'} className='switch-input' type='radio'
                               name={'not_found--' + this.state.med_id} value='false'
                               checked={this.state.not_found === false} hidden={!this.state.is_fhir_med}
                               onChange={this.handleNotFoundChange}/>
                        <label htmlFor={this.state.med_id + 'found'}
                               className="switch-label switch-label-off">found</label>
                        <input id={this.state.med_id + 'not_found'} className='switch-input' type='radio'
                               name={'not_found--' + this.state.med_id} value='true'
                               checked={this.state.not_found === true} hidden={!this.state.is_fhir_med}
                               onChange={this.handleNotFoundChange}/>
                        <label htmlFor={this.state.med_id + 'not_found'} className="switch-label switch-label-on">missing</label>
                        <span className={(this.state.not_found == 'unknown') ? 'hidden' : 'switch-selection'}> </span>
                    </div>
                </td>
                <td className='col-xs-2'>
                    <span className='original-med-name medNameText'>{this.state.med_name}</span>
                    <div>
                        <input className='col-xs-12' type='hidden' value={this.state.med_name} name='med_name'
                               onChange={this.handleMedChange}/>
                        <a style={{'cursor':'pointer'}} onClick={this.alternateMedClick} hidden={!this.state.click_alt}>Enter
                            Alternate Name</a>
                        <input className='col-xs-12 alternativeName' type='text' value={this.state.name_sub}
                               name='name_sub'
                               onChange={this.handleChange} placeholder={this.state.placeholder}
                               required={this.state.is_fhir_med == false}
                               style={{background: 'inherit'}}
                               hidden={this.state.alt_hidden && (this.state.is_fhir_med)}/>
                    </div>
                </td>
                <td className='col-xs-2'>

                    <div hidden={this.state.not_found === true}>
                        <input
                            className={'col-xs-12 removePadding ' + ((this.state.doseDiscrepancy == false) ? "valid" : "invalid")}
                            type='text' value={this.state.dose} name='dose'
                            ref='doseTarget'
                            onChange={this.handleChange} onBlur={this.doseFreqValidation}
                            style={{background: 'inherit'}}/>
                        <Overlay show={(this.state.doseDiscrepancy == false) ? false : true}
                                 target={() => ReactDOM.findDOMNode(this.refs.doseTarget)}
                                 placement='bottom'>
                            {doseTooltip}
                        </Overlay>
                        <div className='loader' hidden={this.state.hideload}><img src='../images/spinner.gif'/></div>
                    </div>

                </td>
                <td className='col-xs-1'>
                    <div hidden={this.state.not_found === true}>
                        <SimpleSelect options={options} placeholder='Freq' className='col-xs-12 removePadding'
                                      style={{width: '100% !important'}}
                                      ref='freqTarget'
                                      onBlur={this.doseFreqValidation}
                                      onValueChange={function(freq){
                                         self.setState({freq:freq.label});
                                      }}

                                      createFromSearch={function(options, search){
                                        if (search.length == 0 || (options.map(function(option){
                                            return option.label;
                                        })).indexOf(search) > -1)
                                            return null;
                                        else
                                            return {label: search, value: search};
                                      }}

                                      renderOption={function(item){
                                        return <div>
                                            <span style={{marginRight: 4, verticalAlign: 'middle', width: 24, fontWeight: 'bold'}}>{item.label}</span>
                                            <span>{item.value}</span>
                                        </div> }}
                        />
                        <Overlay show={(this.state.freqDiscrepancy == false) ? false : true}
                                 target={() => ReactDOM.findDOMNode(this.refs.freqTarget)}
                                 placement='right'>
                            {freqTooltip}
                        </Overlay>
                        <input type='text' value={this.state.freq} name='freq' hidden/>
                    </div>
                </td>
                <td className='col-xs-2'>
                    <div hidden={this.state.not_found === true}>
                        <div className="switch switch-blue">
                            <input id={this.state.med_id + 'yes'} className='switch-input' type='radio'
                                   name={'compliance_bool--' + this.state.med_id} value='true'
                                   checked={this.state.compliance_bool === true} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'yes'}
                                   className="switch-label switch-label-off">yes</label>
                            <input id={this.state.med_id + 'no'} className='switch-input' type='radio'
                                   name={'compliance_bool--' + this.state.med_id} value='false'
                                   checked={this.state.compliance_bool === false} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'no'}
                                   className="switch-label switch-label-on">no</label>
                            <span className='switch-selection'> </span>
                        </div>
                    <textarea id={'complianceNote' + this.state.med_id} className='col-xs-12 removePadding' type='text'
                              value={this.state.noncompliance_note} name='noncompliance_note'
                              rows="1" onChange={this.handleChange} placeholder='please explain'
                              hidden={this.state.compliance_bool}></textarea>
                    </div>
                </td>
                <td className='col-xs-2' hidden={this.state.not_found === true}>
                    <div hidden={this.state.not_found === true}>
                        <div className="switch switch-blue">
                            <input id={this.state.med_id + 'VA'} className='switch-input' type='radio'
                                   name={'med_bool--' + this.state.med_id} value='true'
                                   checked={this.state.med_bool === true} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'VA'}
                                   className="switch-label switch-label-off">VA</label>
                            <input id={this.state.med_id + 'other'} className='switch-input' type='radio'
                                   name={'med_bool--' + this.state.med_id} value='false'
                                   checked={this.state.med_bool === false} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'other'}
                                   className="switch-label switch-label-on">other</label>
                            <span className='switch-selection'> </span>
                        </div>
                    <textarea id={'prescriberNote' + this.state.med_id} className='col-xs-12 removePadding' type='text'
                              value={this.state.prescriber_note} name='prescriber_note'
                              rows="1" onChange={this.handleChange} placeholder='please enter prescriber'
                              hidden={this.state.med_bool}></textarea>
                    </div>
                </td>
                <td className='col-xs-2' hidden={this.state.not_found === true}>
                    <div>
                    <textarea className='col-xs-12 removePadding' type='text' name='note' value={this.state.note}
                              rows="1" onChange={this.handleChange} onFocus={this.flipFreq}
                              style={{background: 'inherit'}}/>
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
