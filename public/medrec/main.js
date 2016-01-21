// skeleton React page
var ViewPage = React.createClass({
    getInitialState: function () {
        return {
	    medication_list_response: ''
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
    render: function () {
        // the page expects two URL parameters: 'token' and 'patient_id'
        // e.g. the URL should look like this in the browser:
        //   http://api.localhost:3000/medrec?token=abc&patient_id=xyz
        var token = this.getUrlParameter('token');
        var patient_id = this.getUrlParameter('patient_id');
        // TODO: validate that token and patient_id are not null
        var fhir_url_base = 'http://fhir.vacareshare.org:8081/baseDstu2'; // TODO: this is hard-coded, get this from config somehow instead
        var fhir_url = fhir_url_base + '/MedicationOrder?_include=MedicationOrder:medication&_format=json&_count=50&patient=' + patient_id;
        // TODO: make an AJAX call to GET 'fhir_url' (using the token in the header), get the resulting medications, and store them in the state
	$.ajax({
            url: fhir_url,
            dataType: 'json',
            headers: {'X-Auth-Token': token},
            success: function (result) {
                this.setState({
		    medication_list_response: result
                });
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(this.props.source, status, err.toString());
            }.bind(this)
        });
        return (
		<div>
		<p>{fhir_url}</p>
                <h1>MedRec Page</h1>
                <p>under construction</p>
		<p>patient id: {patient_id}</p>
		<p>medication list: {this.state.medication_list_response}</p>
            </div>
        )
    }
});

var MedicationList = React.createClass({
    render: function (){

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
