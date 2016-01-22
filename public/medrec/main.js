// skeleton React page
var ViewPage = React.createClass({
    getInitialState: function () {
        return {
            medication_list_response: {}
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
        //var fhir_url = fhir_url_base + '/MedicationOrder?_include=MedicationOrder:medication&_format=json&_count=50&patient=' + patient_id;
        var fhir_url = fhir_url_base + '/MedicationOrder?_count=50&_format=json&_include=MedicationOrder%3Amedication&patient=' + patient_id;
        // TODO: make an AJAX call to GET 'fhir_url' (using the token in the header), get the resulting medications, and store them in the state

        //Patient ID to use: 1452917292723-444-44-4444
        $.ajax({
            url: fhir_url,
            dataType: 'json',
            type: 'GET',
            //cache: false,
            headers: {'X-Auth-Token': token},
            success: function (result) {
                //console.log(JSON.stringify(result.entry[0]));
                var initial = 0;
                for (var i=0;i < result.entry.length; i++){
                    if(result.entry[i].resource.resourceType==="Medication"){
                        //Do work
                        if(initial === 0){
                            initial = i;
                        }
                        var obj = this.state.medication_list_response;
                        obj[i - initial] =result.entry[i].resource.code.text;
                        this.setState(obj);
                    }
                }
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
        return (
            <div>
                <h1>Enter Modifications</h1>
                <MedRecInfoList />
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
        return (
            <ol>
            <MedRecInfo/>
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
            med_name: 'Advil',
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
