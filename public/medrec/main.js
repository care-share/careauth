function getUrlParameter (sParam) {
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

// skeleton React page
var ViewPage = React.createClass({
    getInitialState: function () {
        return {
            medication_list_response: []
        };
    },
    loadDataFromServer: function() {
        // the page expects two URL parameters: 'token' and 'patient_id'
        // e.g. the URL should look like this in the browser:
        //   http://api.localhost:3000/medrec?token=abc&patient_id=xyz
        var token = getUrlParameter('token');
        var patient_id = getUrlParameter('patient_id');
        // TODO: validate that token and patient_id are not null
        var fhir_url_base = 'http://fhir.vacareshare.org:3000'; // TODO: this is hard-coded, get this from config somehow instead
        var fhir_url = fhir_url_base + '/MedicationOrder?_include=MedicationOrder:medication&_format=json&_count=50&patient=' + patient_id;
        //var fhir_url = fhir_url_base + '/MedicationOrder?_count=50&_format=json&_include=MedicationOrder%3Amedication&patient=' + patient_id;
        // TODO: make an AJAX call to GET 'fhir_url' (using the token in the header), get the resulting medications, and store them in the state

        //Patient ID to use: 1452917292723-444-44-4444
        $.ajax({
            url: fhir_url,
            dataType: 'json',
            type: 'GET',
            headers: {'X-Auth-Token': token},
            success: function (result) {
                //console.log(JSON.stringify(result.entry[0]));
                var state = this.state.medication_list_response;
                for (var i = 0; i < result.entry.length; i++) {
                    if (result.entry[i].resource.resourceType === "Medication") {
                        var id = result.entry[i].resource.id;
                        var text = result.entry[i].resource.code.text;
                        state[i] = {id: id, text: text};
                    }
                }
                this.setState(state);
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(this.props.source, status, err.toString());
            }.bind(this)
        });
    },
    componentDidMount: function() {
        this.loadDataFromServer();
    },
    render: function () {
        var token = getUrlParameter('token');
        return (
            <div>
                <h1>Enter Medications</h1>
                <MedRecInfoList
                    fhirMedications={this.state.medication_list_response} token={token}
                />
            </div>
        )
    }
});

//TODO create add button to add another MedRecInfo

var MedRecInfoList = React.createClass({
    getInitialState: function () {
        return {
            allMedications: [],
            id: 10000000,
            addHiddem: false,
            submitHidden: false
        };
    },
    handleAdd: function (){
        // changed state of allMedications, append empty MedRecInfo item
        var newMed = this.state.allMedications;
        newMed.push({id: new Date().getTime() + '-' + this.state.id, text: "new medication name"});
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

        $('#myform').submit(function () {
            var frm = $(this);
            var dat = {
                patient_id: getUrlParameter('patient_id'),
                formData: frm.serializeArray()
            };

            console.log("I am about to POST this:\n\n" + JSON.stringify(dat, null, 2));
            $.ajax({
                type: "POST",
                url: "/medrecs",
                headers: {'X-Auth-Token': token},
                data: JSON.stringify(dat),
                success: function (result) {
                    console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                },
                dataType: "json",
                contentType: "application/json"
            });
        });

    },
    componentDidMount: function(){
        this.setState({allMedications: this.props.fhirMedications});
    },
    render: function () {

        return (
            <form id="myform" onSubmit={this.handleSubmit}>
            
                <div className="container"> 
                    <div className="row">
                    <div className="col-xs-2">
                        Medication Name
                    </div>
                    <div className="col-xs-2">
                        Name if Different
                    </div>
                    <div className="col-xs-2">
                        Dosage  
                    </div>
                    <div className="col-xs-2">
                        Frequency
                    </div>
                    <div className="col-xs-1">
                        Patient Reports Compliance:
                                
                    </div>
                    <div className="col-xs-1">
                        VA Med?
                    </div>
                    <div className="col-xs-2">
                        Notes
                    </div>
           
            </div>






                    {this.state.allMedications.map(function(medication){
                        return <MedRecInfo fhirMedications={medication.text} key={medication.id}/>; // display each medication
                    })}
                </div>
                        
            <table>
                    <tbody>
                    <tr>
                        <td>
                            <button onClick={this.handleAdd} hidden={this.state.addHidden}>add new</button>
                        </td>
                        <td>
                            <button onClick={this.handleChanges} hidden={this.state.submitHidden}>submit changes</button>
                        </td>
                    </tr>
                    </tbody>
                </table>
             </form>
        );
    }
});

//Header Enter Medications
//Numbered List
//header <med_name>
//CheckBox, label "Drug name Substitution", input area
//label "Dose: ", input area
//label "Frequency: ", input area
//header "Patient Reports"
//label "Compliance: " radio yes/no (change to yes/no slider)
//label "VA Med?: " radio yes/no (change to yes/no slider)
//label "Note: " input area (large)

//TODO add hidden FHIR id value to POST when submitting

var MedRecInfo = React.createClass({
    getInitialState: function () {
        return {
            med_name: '',
            name_sub: '',
            dose: '',
            freq: '',
            complianceBool: '',
            medBool: '',
            note: '',
            fhir_id: ''
        };
    },
    handleChange: function (event) {
        var obj = {};
        obj[event.target.name] = event.target.value;
        this.setState(obj);
    },
    handleMedChange: function (event) {
        if(this.state.fhir_id == "false"){ // if not a fhir medication name field then can edit and update state
            var obj = {};
            obj[event.target.name] = event.target.value;
            this.setState(obj);
        }
    },
    componentDidMount: function(){
        var isFhirMed = 'true';
        if(this.props.fhirMedications == "new medication name"){
            isFhirMed = 'false';
        }
        this.setState({med_name: this.props.fhirMedications, fhir_id: isFhirMed});
    },
    render: function () {
        return (
	    <div className="row">
            <div className="col-xs-2">
                <input className="form-control col-xs-2" type="text" value={this.state.med_name} name="med_name"
                                    onChange={this.handleMedChange}></input>
            </div>
            <div className="col-xs-2">
                <input className="col-xs-12" type="text" value={this.state.name_sub} name="name_sub"
                                   onChange={this.handleChange}></input>
            </div>
            <div className="col-xs-2">
                <input className="col-xs-12" type="text" value={this.state.dose} name="dose"
                                         onChange={this.handleChange}></input>  
            </div>
            <div className="col-xs-2">
                <input className="col-xs-12" type="text" value={this.state.freq} name="freq"
                                              onChange={this.handleChange}></input>
            </div>
            <div className="col-xs-1">
                <label><input type="radio" name="compliance_bool" value="yes" onClick={this.handleChange}></input> yes</label>
                <label><input type="radio" name="compliance_bool" value="no" onClick={this.handleChange}></input> no</label>
                        
            </div>
            <div className="col-xs-1">
                                <label><input type="radio" name="med_bool" value="yes" onClick={this.handleChange}></input> yes</label>
                                <label><input type="radio" name="med_bool" value="no" onClick={this.handleChange}></input> no</label>
            </div>
            <div className="col-xs-2">
                <input className="col-xs-12" type="text" name="note" value={this.state.note}
                                         onChange={this.handleChange}></input>
            </div>
   
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
