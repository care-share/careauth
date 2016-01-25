// skeleton React page
var ViewPage = React.createClass({
    getInitialState: function () {
        return {
            medication_list_response: []
        };
    },
    getUrlParameter: function (sParam) {
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
    },
    loadDataFromServer: function() {
        // the page expects two URL parameters: 'token' and 'patient_id'
        // e.g. the URL should look like this in the browser:
        //   http://api.localhost:3000/medrec?token=abc&patient_id=xyz
        var token = this.getUrlParameter('token');
        var patient_id = this.getUrlParameter('patient_id');
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
        var token = this.getUrlParameter('token');
        return (
            <div>
                <h1>Enter Modifications</h1>
                <MedRecInfoList
                    medList = {this.state.medication_list_response}
                    token={token}
                />
            </div>
        )
    }
});

//TODO create add button to add another MedRecInfo

var MedRecInfoList = React.createClass({
    getInitialState: function () {
        return {};
    },
    render: function () {
        var token = this.props.token;
        return (
            <ol>
                {this.props.medList.map(function(result){
                    return <MedRecInfo key={result.id} name = {result.text}/>
                })}
            </ol>
        );
    }
});

//Header Enter Modifications
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
    componentWillReceiveProps: function (nextProps) {
        this.setState({
           med_name: nextProps.text
        });
    },
    handleChange: function (event) {
        var obj = {};
        obj[event.target.name] = event.target.value;
        this.setState(obj);
    },
    submitChanges: function (e) {
        var token = this.props.token;
        console.log('Posting to data to mongoDB');
        // Test data:
        var test_data = {
                "_id": "x100",
                "patient_id": "x200",
                "created_by": "x300",
                "name_sub": "Ibuprofen",
                "dose": "10MG",
                "freq": "twice daily",
                "compliance_bool": false,
                "med_bool": false,
                "note": "no note",
                "timestamp": new Date().getTime()
            };

        // Need to loop through entire med list to post to mongoDB
        $.ajax({
            type: "POST",
            url: "/medrecs",
            headers: {'X-Auth-Token': token},
            data: JSON.stringify(test_data),
            success: function () {
                console.log('SUCCESS');
                // reset form field to empty
            },
            dataType: "json",
            contentType: "application/json"
        });

    },
    render: function () {
        return (
            <li>
                <h2>{this.state.med_name}</h2>
                <table>
                    <tbody>
                    <tr>
                        <td>Drug name substitution
                            <input type="text" value={this.state.name_sub} name="name_sub"
                                   onChange={this.handleChange}></input>
                        </td>
                    </tr>
                    <tr>
                        <td>Dose: <input type="text" value={this.state.dose} name="dose"
                                         onChange={this.handleChange}></input></td>
                    </tr>
                    <tr>
                        <td>Frequency: <input type="text" value={this.state.freq} name="freq"
                                              onChange={this.handleChange}></input></td>
                    </tr>
                    </tbody>
                </table>
                <h2>Patient Reports</h2>
                <table>
                    <tbody>
                    <tr>
                        <td>Compliance:
                            <form action="">
                                <input type="radio" name="compliance_bool" value="yes" onClick={this.handleChange}>
                                    </input>
                                <input type="radio" name="compliance_bool" value="no" onClick={this.handleChange}>
                                    </input>
                            </form>
                        </td>
                    </tr>
                    <tr>
                        <td>VA Med?
                            <form>
                                <input type="radio" name="med_bool" value="yes" onClick={this.handleChange}></input>
                                <input type="radio" name="med_bool" value="no" onClick={this.handleChange}></input>
                            </form>
                        </td>
                    </tr>
                    <tr>
                        <td>Note: <input type="text" name="note" value={this.state.note}
                                         onChange={this.handleChange}></input></td>
                    </tr>
                    <tr>
                        <td>
                            <input type="submit" value="submit password" onClick={this.submitChanges}></input>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </li>
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
