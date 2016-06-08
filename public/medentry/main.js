//Includes React Selectize MultiSelect
//MultiSelect = require('react-selectize').MultiSelect;
var SimpleSelect = reactSelectize.SimpleSelect;
var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;
var Overlay = ReactBootstrap.Overlay;
var Modal = ReactBootstrap.Modal;
var Alert = ReactBootstrap.Alert;

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
                var state = this.state.medication_list_response; // array
                var map = {};
                var medOrders = [];
                var nextMed = 0;
                for (var i = 0; i < result.entry.length; i++) {
                    var resType = result.entry[i].resource.resourceType;
                    if (resType === 'Medication') {
                        var id = result.entry[i].resource.id;
                        var text = result.entry[i].resource.code.text;
                        state[nextMed] =
                        {
                            id: id,
                            text: text,
                            completed: false,
                            not_found: '',
                            prescriber: 'true',
                            med_discrepancy: false,
                            note: ''
                        };
                        map[id] = nextMed++;
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

                // Loops through and sorts final array
                state.sort(function (a, b) {
                    if (a.text > b.text) {
                        return 1;
                    }
                    if (a.text < b.text) {
                        return -1;
                    }
                    return 0;
                });

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
                <MedEntryInfoList fhirMedications={this.state.medication_list_response} token={token}/>
            </div>
        )
    }
});

function doSort(param, isAscending) {
    return function (a, b) {
        if (a[param] < b[param]) {
            return isAscending ? -1 : 1;
        }
        if (a[param] > b[param]) {
            return isAscending ? 1 : -1;
        }
        return 0;
    }
}

var MedEntryInfoList = React.createClass({
    getInitialState: function () {
        return {
            allMedications: [],
            id: 10000000,
            addHidden: false,
            disable_submit: true,
            show_modal: false
        };
    },
    updateName: function (medid, field, val) {
        var meds = this.state.allMedications;
        var loc = meds.map(function (x) {
            return x.id
        }).indexOf(medid);

        if (loc !== -1) {
            //update states
            console.log('Id is found, updating ' + field + ' to ' + val);
            var updated_med = meds[loc];
            updated_med[field] = val;
            meds[loc] = updated_med;
        }
        this.setState({allMedications: meds});
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
        //Check discrepancies here
        var state = this.state.allMedications;
        var hasDisc = false;
        for (var x = 0; x < state.length; x++)
            if (state[x].med_discrepancy)
                hasDisc = true;

        if (hasDisc) {
            this.setState({show_modal: true});
        }
        else {
            var frm = $('#myform').serializeArray();
            for (var i = frm.length - 1; i >= 0; i--) {
                frm[i].name = frm[i].name.split('--')[0]
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
                    $('.submitBtn').attr('hidden', 'true');
                    $('.add_button').attr('hidden', 'true');
                    $('.panel').attr('hidden', 'true');
                },
                dataType: 'json',
                contentType: 'application/json'
            });
        }
    },
    sortMedList: function (key, isAscending) {
        var allMeds = this.state.allMedications;
        allMeds.sort(doSort(key, isAscending));
        this.setState({allMedications: allMeds});
    },
    componentDidMount: function () {
        this.setState({allMedications: this.props.fhirMedications});
    },
    handleComplete: function (medid, status) {
        var state = this.state.allMedications;
        var loc = state.map(function (x) {
            return x.id
        }).indexOf(medid);
        if (loc !== -1) {
            state[loc].completed = status;
        }
        this.setState({allMedications: state});
        for (var it = 0; it < state.length; it++) {
            if (state[it] !== undefined) {
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
    close: function () {
        this.setState({show_modal: false});
    },
    continue: function () {
        // async setState because React handles click events this way... handleChanges is the callback
        this.setState({show_modal: false}, this.handleChanges);
        //this.handleChanges();
    },
    render: function () {
        var self = this;
        return (
            <form id='myform' onSubmit={this.handleSubmit} autoComplete='off'>
                <div className='col-sm-12'>
                    <div className='panel panel-default' style={{display:'flex',flexDirection:'column',height:'100vh'}}>
                        <div className='panel-heading' style={{padding:'10px 15px 20px'}}>
                            <h2 className='panel-title'>Please Enter Medications As You Find Them In The Home.
                                This List Will Be Reconciled With VA Provider Records,
                                And You May Be Contacted For Clarification Later.</h2>
                        </div>
                        <div className='container-fluid full-width med-list' style={{width:'100%'}}>
                            <div className='row header'>
                                <div className='col-xs-1'>
                                    <div className='order pull-left'>
                                        <a style={{cursor:'pointer'}} className='asc'
                                           onClick={() => this.sortMedList('not_found',true)}>&uarr;</a>
                                        <a style={{cursor:'pointer'}} className='desc'
                                           onClick={() => this.sortMedList('not_found',false)}>&darr;</a>
                                    </div>
                                    Found
                                </div>
                                <div className='col-xs-2'>
                                    <div className='order pull-left'>
                                        <a style={{cursor:'pointer'}} className='asc'
                                           onClick={() => this.sortMedList('text',true)}>&uarr;</a>
                                        <a style={{cursor:'pointer'}} className='desc'
                                           onClick={() => this.sortMedList('text',false)}>&darr;</a>
                                    </div>
                                    Medication Name
                                </div>
                                <div className='col-xs-1'>
                                    Dosage & Strength
                                </div>
                                <div className='col-xs-2' style={{padding:'0',margin:'0'}}>
                                    Frequency
                                </div>
                                <div className='col-xs-1' style={{padding:'0',margin:'0'}}>
                                    Patient Reports Adherence
                                </div>
                                <div className='col-xs-1'>
                                    <div className='order pull-left'>
                                        <a style={{cursor:'pointer'}} className='asc'
                                           onClick={() => this.sortMedList('prescriber',true)}>&uarr;</a>
                                        <a style={{cursor:'pointer'}} className='desc'
                                           onClick={() => this.sortMedList('prescriber',false)}>&darr;</a>
                                    </div>
                                    Prescriber
                                </div>
                                <div className='col-xs-1'>
                                    Discrepancy
                                </div>
                                <div className='col-xs-3'>
                                    Notes
                                </div>
                            </div>
                        </div>
                        <div className='container panel-body med-list' style={{'overflowY':'scroll',
                         'overflowX':'hidden',width:'100%'}}>
                            {this.state.allMedications.map(function (medication) {
                                return <MedEntryInfo fhirMedications={medication.text}
                                                     key={medication.id}
                                                     medId={medication.id}
                                                     orderId={medication.orderId}
                                                     medOrder={medication.medorder}
                                                     handleComplete={self.handleComplete}
                                                     updateName={self.updateName}
                                                     ref={medication.id}
                                />; // display each medication
                            })}
                        </div>
                        <div className='panel-footer' style={{height:'65px',padding:'15px 15px 30px'}}>
                            <div className='col-xs-2  add_button'>
                                <button className='form-control' onClick={this.handleAdd} hidden={this.state.addHidden}>
                                    Add New
                                </button>
                            </div>
                            <div className='col-xs-5'></div>
                            <div className='col-xs-3'>
                                <span hidden={!this.state.disable_submit}>Please Complete The Form To Submit</span>
                            </div>
                            <div className='col-xs-2 submitBtn'>
                                <button className='form-control' disabled={this.state.disable_submit}
                                    onClick={this.handleChanges}>Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <Modal show={this.state.show_modal} onHide={this.close}>
                        <Modal.Header closeButton>
                            <Modal.Title>Discrepancy</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <strong>There Is An Unaddressed Discrepancy. Click Cancel To Address It, Or Continue To
                                Submit Anyway</strong>
                            <br />
                            <table>
                                {this.state.allMedications.map(function (medication) {
                                    //When textarea updates, need to send that data to the child
                                    var disc_status = medication.med_discrepancy;
                                    var meds = self.state.allMedications;
                                    var loc = meds.map(function (x) {
                                        return x.id
                                    }).indexOf(medication.id);

                                    function update(e) {
                                        var obj = self.state.allMedications;
                                        obj[loc].note = e.target.value;
                                        self.setState({allMedications: obj});
                                    }

                                    if (disc_status)
                                        return <tbody>
                                        <tr>
                                            <td><strong>{medication.text + ': '}</strong></td>
                                        </tr>
                                        <tr>
                                            <td><span>{disc_status}</span></td>
                                            <td> <textarea type='text' name='note' placeholder='Address Discrepancy'
                                                           value={self.state.allMedications[loc].note}
                                                           rows='1' onChange={update}
                                                           onBlur={() => self.refs[medication.id].updateNote(
                                                               self.state.allMedications[loc].note)}/>
                                            </td>
                                        </tr>
                                        </tbody>
                                })}
                            </table>
                        </Modal.Body>
                        <Modal.Footer>
                            <button onClick={this.close}>Cancel</button>
                            <button onClick={this.continue}>Continue</button>
                        </Modal.Footer>
                    </Modal>
                </div>
                <div hidden className='success-message' name='submit_success'>
                    <Alert bsStyle='success'>
                        <strong>Submitted Successfully!</strong>
                    </Alert>
                </div>
            </form>
        );
    }
});

/**
 * MedEntryInfo
 * Displays each medication via props passed from MedEntryInfoList
 */
var MedEntryInfo = React.createClass({
    //Defines and initializes all states for this medication
    getInitialState: function () {
        return {
            med_id: '',       // FHIR ID of this Medication (if applicable)
            order_id: '',       // FHIR ID of the MedicationOrder that references this Medication (if applicable)
            med_name: '',       // Name of Medication passed from MedEntryInfoList
            name_sub: '',       // User entered name via alternate name form OR if User Medication
            dose: '',       // User entered dosage via dosage input
            ehr_dose: '',       // Dosage found in database when Transcript API is called
            freq: '',       // User entered frequency via frequency Type-a-head form
            ehr_freq: '',       // Frequency found in database when Transcript API is called
            compliance_bool: true,     // Boolean indicating if the medication adheres to patient reports; manipulated via patient reports toggle
            noncompliance_note: '',       // Textarea used to address noncompliance by user
            med_bool: true,     // Boolean indicating if the medication is prescribed by VA/other; manipulated via Prescriber toggle
            prescriber_note: '',       // Textarea used to address who prescribed medication
            note: '',       // Textarea used to address discrepancies found via Transcript API
            is_fhir_med: false,    // Boolean used when a user enters a new medication
            placeholder: '',       // String used when user enters new medication to set placeholder text
            not_found: 'unknown',// Boolean used when a user sets the medication to missing; manipulated via Found toggle
            alt_hidden: true,     // Boolean used to hide alternate name form
            dose_discrepancy: false,    // Boolean used to indicate if there is a discrepancy between dose and ehr_dose on Transcript API
            freq_discrepancy: false,    // Boolean used to indicate if there is a discrepancy between freq and ehr_freq on Transcript API
            hide_load: true,     // Boolean used to set the visibility of loading wheel
            med_order: {},       // Object passed via props from MedEntryInfoList; used when calling Transcript API
            click_alt: true,     // Boolean used to hide alternate name link
            row_discrepancy: false,    // Boolean indicating whether or not this medication has a un-addressed discrepancy,
            show_tooltip: false,    // Boolean used to set the visibility of Tooltip
            tooltip_message: '',       // String used by DiscTooltip to display discrepancies
            dropdown_direction: 1,         // Integer used by Frequency Dropdown to determine direction to display dropdown
            offset: 0   //Double used by Frequency Dropdown to determine Y location
        };
    },

    //Used to change the state from inputs and toggles within Medication row
    handleChange: function (event) {
        if (event.target.name !== 'note')
            this.setState({not_found: false});

        var obj = {};
        var value = event.target.value;
        if (event.target.type === 'checkbox')
            value = (value === 'false');

        if (event.target.name === 'name_sub') {
            value = value.toUpperCase();
            this.props.updateName(this.state.med_id, 'text', event.target.value);
        }

        obj[event.target.name] = value;
        this.setState(obj);

        if (event.target.name === 'freq' && event.target.value === '') {
            if (this.state.dose === '') {
                this.removeRowDisc();
                this.setState({row_discrepancy: false});
                this.flipDisc();
            }
        }

        if (event.target.name === 'dose' && event.target.value === '') {
            if (this.state.freq === '') {
                this.removeRowDisc();
                this.setState({row_discrepancy: false});
                this.flipDisc();
            }
        }

        //If changing state of note AND there is a discrepancy, remove row disc
        if (event.target.name === 'note' && this.state.row_discrepancy) {
            if (value === '')
                this.addRowDisc();
            else
                this.removeRowDisc();
        }
    },

    //Used to update note from Modal once MedEntryInfoList gets submitted
    updateNote: function (myNote) {
        if (myNote === '')
            this.addRowDisc();
        else
            this.removeRowDisc();

        this.setState({note: myNote});
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
            dose_discrepancy: false,
            freq_discrepancy: false,
            show_tooltip: false,
            click_alt: (event.target.value === 'false'),
            alt_hidden: true
        });
        this.props.updateName(this.state.med_id, 'not_found', event.target.value);

        //If medication is missing, remove row highlighting and indicate to parent this is ready to submit
        if ((event.target.value === 'true')) {
            this.removeRowDisc();
            this.props.handleComplete(this.state.med_id, true);
        }
        //If medication is found, check if discrepancy exists. If discrepancy does exist, check if note exists.
        else {
            if (this.state.dose && this.state.freq)
                this.props.handleComplete(this.state.med_id, true);
            else
                this.props.handleComplete(this.state.med_id, false);

            //Check if there is an unaddressed discrepancy for this medication
            if (this.state.row_discrepancy) {
                //Check if the discrepancy has been addressed via note
                if (this.state.note !== '') {
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
    addRowDisc: function () {
        var toolString = '';
        if (this.state.dose_discrepancy) {
            toolString += ('Prescriber Dose Is: ' + this.state.ehr_dose + '\n');
        }
        if (this.state.freq_discrepancy) {
            toolString += ('Prescriber Freq Is: ' + this.state.ehr_freq);
        }
        this.setState({tooltip_message: toolString});

        this.props.updateName(this.state.med_id, 'med_discrepancy', toolString);
        $('#' + this.state.med_id).addClass('med_row');
    },
    removeRowDisc: function () {
        this.props.updateName(this.state.med_id, 'med_discrepancy', false);
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

        if (stateName === 'med_bool')
            this.props.updateName(this.state.med_id, 'prescriber', (this.state.med_bool) ? 'false' : 'true');


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

        // FIXME: don't use a 'truthy' comparison (use ===)
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
            // FIXME: don't use a 'truthy' comparison (use ===)
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
        this.setState({dose_discrepancy: false, freq_discrepancy: false, hide_load: false, show_tooltip: false});

        var self = this;

        function finish() {
            self.setState({hide_load: true});
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
                                dose_discrepancy: result.data.discrepancy.dose,
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
                            dose_discrepancy: false,
                            ehr_dose: ''
                        });
                    }

                    //Checks to see if frequency has a discrepancy
                    if (result.data.discrepancy.freq) {
                        var ehrfreq = self.displayCode(result.data.ehrMed.dosageInstruction[0].timing.repeat);
                        console.log(ehrfreq);
                        this.setState({freq_discrepancy: result.data.discrepancy.freq, ehr_freq: ehrfreq});
                    }

                    //If undefined, set states to none
                    if (result.data.discrepancy.freq == undefined) {
                        this.setState({freq_discrepancy: false, ehr_freq: ''});
                    }

                    //When done, check both states. if either one is true, set row discrepancy to true
                    //If false, set row discrepancy to false
                    if (this.state.freq_discrepancy || this.state.dose_discrepancy) {
                        //Has to be structured this way otherwise tooltip cannot find button
                        this.setState({row_discrepancy: true}, this.addRowDisc);
                        this.setState({show_tooltip: true});
                    } else {
                        //Has to be structured this way otherwise tooltip cannot find button
                        this.setState({row_discrepancy: false}, this.removeRowDisc);
                        this.setState({show_tooltip: false});
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
    getOffset: function() {
        var offset = $('#'+this.state.med_id).offset();
        this.setState({offset: offset});
        console.log(this.state.med_name+': '+JSON.stringify(offset));
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
        }, this.getOffset);
    },
    doseFreqValidation: function () {
        // dose & freq field must be filled out
        if ((this.state.dose != '') && (this.state.freq != '')) {
            console.log('Calls loadMedPairData');
            this.loadMedPairData();
            this.props.handleComplete(this.state.med_id, true);
        } else {
            this.props.handleComplete(this.state.med_id, false);
        }
    },
    flipDisc: function () {
        this.setState({show_tooltip: !this.state.show_tooltip});
    },
    render: function () {
        // IMPORTANT NOTE: for server-side processing to work correctly, not_found MUST be the first form field!
        $('.note'+this.state.med_id).elastic();
        var self = this,
            options = [
                {label: 'Every Day', value: 'every day'}, {label: 'Every Other Day', value: 'every other day'},
                {label: 'Every Morning', value: 'every morning'}, {label: 'Every Afternoon', value: 'every afternoon'},
                {label: 'Every Evening', value: 'every evening'}, {
                    label: 'Two Times Per Day',
                    value: 'two times per day'
                },
                {label: 'Three Times Per Day', value: 'three times per day'}, {
                    label: 'Four Times Per Day',
                    value: 'four times per day'
                },
                {label: 'As Needed', value: 'as needed'}, {label: 'Every Week', value: 'every week'},
                {label: 'With Meals', value: 'with meals'}
            ];

        //TODO: Fix frequency hidden attribute to be dynamic
        var discTooltip = (<Tooltip id={this.state.med_id}>
            <a style={{position: 'absolute',top: '0px',right: '16px',fontSize:'large',cursor:'pointer'}}
               onClick={this.flipDisc}>x</a>
            <br />
            <strong>{this.state.tooltip_message}</strong>
        </Tooltip>);

        return (
            <div className='row med' id={this.state.med_id}>
                {/*
                    This div defines the medication row, and is the Bootstrap container for all medication info.
                    Each element (paired with a column of varying size) must be given it's own unique 'id'.
                */}

                <div className='col-xs-1' style={{paddingLeft:'5px'}}>
                    {/*
                        This column contains the Not Found switch.
                        o  The 'switch' is implemented using Vanilla CSS found in Careauth.css @ ln 93
                        o  Updates state: not_found
                    */}
                    <div className='switch switch-blue' hidden={!this.state.is_fhir_med}>
                        <input id={this.state.med_id + 'found'} className='switch-input' type='radio'
                               name={'not_found--' + this.state.med_id} value='false'
                               checked={this.state.not_found === false} hidden={!this.state.is_fhir_med}
                               onChange={this.handleNotFoundChange}/>
                        <label htmlFor={this.state.med_id + 'found'}
                               className='switch-label switch-label-off'>Found</label>
                        <input id={this.state.med_id + 'not_found'} className='switch-input' type='radio'
                               name={'not_found--' + this.state.med_id} value='true'
                               checked={this.state.not_found === true} hidden={!this.state.is_fhir_med}
                               onChange={this.handleNotFoundChange}/>
                        <label htmlFor={this.state.med_id + 'not_found'} className='switch-label switch-label-on'>Missing</label>
                        <span className={(this.state.not_found == 'unknown') ? 'hidden' : 'switch-selection'}> </span>
                    </div>
                </div>

                <div className='col-xs-2'>
                    {/*
                        This column contains Medication name and Alternate Med name.
                        o  Updates state: med_name, name_sub
                    */}
                    <span className='original-med-name medNameText'
                          style={{width:'100%',wordWrap:'break-word'}}>{this.state.med_name}</span>
                    <div>
                        <input type='hidden' value={this.state.med_name} name='med_name'
                               onChange={this.handleChange}/>
                        <a style={{'cursor':'pointer'}} onClick={this.alternateMedClick}
                           hidden={!this.state.click_alt || !this.state.is_fhir_med}>Enter Alternate Name</a>
                        <input className='col-xs-12 alternativeName' type='text' value={this.state.name_sub}
                               name='name_sub'
                               onChange={this.handleChange} placeholder={this.state.placeholder}
                               required={this.state.is_fhir_med == false}
                               style={{background: 'inherit'}}
                               hidden={this.state.alt_hidden && (this.state.is_fhir_med)}/>
                    </div>
                </div>

                <div className='col-xs-1'>
                    {/*
                     This column contains Dosage & Strength input
                     o  Updates state: dose
                     */}
                    <div hidden={this.state.not_found === true}>
                        <input
                            className={'col-xs-12 removePadding ' + ((this.state.dose_discrepancy == false) ? 'valid' : 'invalid')}
                            type='text' value={this.state.dose} name='dose'
                            onChange={this.handleChange} onBlur={this.doseFreqValidation}
                            style={{background: 'inherit'}}/>
                    </div>
                </div>

                <div className='col-xs-2' style={{padding:'0',margin:'0'}}>
                    {/*
                     This column contains the Frequency type-ahead input.
                     o  Created with the React Selectize tool.
                     o  Updates state: freq
                     */}
                    <div hidden={this.state.not_found === true}>
                        <SimpleSelect options={options} placeholder='Frequency' className='col-xs-12 removePadding'
                                      style={{width: '100% !important',background:'inherit'}}
                                      onBlur={this.doseFreqValidation}
                                      ref='select'
                                      
                                      onFocus={this.getOffset}
                                      onValueChange={function(freq){
                                      if(freq !== undefined)
                                         self.setState({freq:freq.label});
                                      else
                                         self.setState({freq:''});
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
                                        </div> }}
                        />
                        <input type='text' value={this.state.freq} name='freq' hidden/>
                    </div>
                </div>

                <div className='col-xs-1' style={{padding:'0',margin:'0'}}>
                    {/*
                     This column contains Patient Reports Adherence toggle
                     o  Textarea becomes visible if toggle is set to no
                     o  Updates state: compliance_bool, noncompliance_note
                     */}
                    <div hidden={this.state.not_found === true}>
                        <div className='switch switch-blue'>
                            <input id={this.state.med_id + 'yes'} className='switch-input' type='radio'
                                   name={'compliance_bool--' + this.state.med_id} value='true'
                                   checked={this.state.compliance_bool === true} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'yes'}
                                   className='switch-label switch-label-off'>Yes</label>
                            <input id={this.state.med_id + 'no'} className='switch-input' type='radio'
                                   name={'compliance_bool--' + this.state.med_id} value='false'
                                   checked={this.state.compliance_bool === false} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'no'}
                                   className='switch-label switch-label-on'>No</label>
                            <span className='switch-selection'> </span>
                        </div>
                    <textarea id={'complianceNote' + this.state.med_id} className='col-xs-12 removePadding' type='text'
                              value={this.state.noncompliance_note} name='noncompliance_note'
                              rows='1' onChange={this.handleChange} placeholder='please explain'
                              hidden={this.state.compliance_bool}></textarea>
                    </div>
                </div>

                <div className='col-xs-1' hidden={this.state.not_found === true}>
                    {/*
                     This column contains Prescriber toggle
                     o  Textarea becomes visible if toggle is set to other
                     o  Updates state: med_bool, prescriber_note
                     */}
                    <div hidden={this.state.not_found === true}>
                        <div className='switch switch-blue'>
                            <input id={this.state.med_id + 'VA'} className='switch-input' type='radio'
                                   name={'med_bool--' + this.state.med_id} value='true'
                                   checked={this.state.med_bool === true} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'VA'}
                                   className='switch-label switch-label-off'>VA</label>
                            <input id={this.state.med_id + 'other'} className='switch-input' type='radio'
                                   name={'med_bool--' + this.state.med_id} value='false'
                                   checked={this.state.med_bool === false} hidden={!this.state.is_fhir_med}
                                   onChange={this.handleOnChange}/>
                            <label htmlFor={this.state.med_id + 'other'}
                                   className='switch-label switch-label-on'>Other</label>
                            <span className='switch-selection'> </span>
                        </div>
                    <textarea id={'prescriberNote' + this.state.med_id} className='col-xs-12 removePadding' type='text'
                              value={this.state.prescriber_note} name='prescriber_note'
                              rows='1' onChange={this.handleChange} placeholder='please enter prescriber'
                              hidden={this.state.med_bool}></textarea>
                    </div>
                </div>

                <div className='col-xs-1' id={'tooltip_'+this.state.med_id} style={{textAlign:'center'}}>
                    {/*
                     This column contains discrepancy tooltip
                     o  Tooltip becomes visible if row has a discrepancy (via Transcript API)
                     o  Loading wheel becomes visible while the AJAX call to Transcript is executing
                     */}
                    <div hidden={!this.state.row_discrepancy || !this.state.is_fhir_med || this.state.not_found}>
                        <button onClick={this.flipDisc} hidden={this.state.not_found} style={{padding:'0',border:'none',background:'none'}}>
                            <span ref='tipTarget' id={'disc_span_'+this.state.med_id}
                                  style={{color: '#ffcc00',background: 'yellow',padding: '3px'}}
                                  className='glyphicon glyphicon-warning-sign black'></span>
                        </button>
                        <Overlay show={this.state.show_tooltip}
                                 container={document.getElementById('tooltip_'+this.state.med_id)}
                                 target={() => ReactDOM.findDOMNode(this.refs.tipTarget)}
                                 placement='bottom'>
                            {discTooltip}
                        </Overlay>
                    </div>
                    <div className='loader' hidden={this.state.hide_load}><img src='../images/spinner2.gif'/></div>
                </div>
                {/*
                 This column contains notes textarea
                 o  Textarea uses Elastic.js to autosize based upon content.
                 o  Updates state: note
                 */}
                <div className='col-xs-3' hidden={this.state.not_found === true}>
                    <div>
                    <textarea type='text' name='note' value={this.state.note} onChange={this.handleChange} className={'note'+this.state.med_id}
                              style={{background:'inherit', resize:'vertical',width:'100%'}}/>
                    </div>
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
