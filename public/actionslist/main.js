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
            medicationPairListResponse: []
        };
    },
    loadDataFromServer: function () {
        // the page expects two URL parameters: 'token' and 'patient_id'
        // e.g. the URL should look like this in the browser:
        //   http://api.domain:3000/actionslist?token=abc&patient_id=xyz
        var token = getUrlParameter('token');
        var patient_id = getUrlParameter('patient_id');
        // TODO: validate that token and patient_id are not null

        var medRecPath = '/actionlist/patient_id/' + patient_id;

        console.log('Requesting data from mongoDB at: ' + medRecPath);
        $.ajax({
            type: 'GET',
            url: medRecPath,
            dataType: 'json',
            headers: {'X-Auth-Token': token},
            success: function (result) {
                console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                var data = this.state.medicationPairListResponse;
                for(var i = 0; i < result.data.length; i++){
                    data[i] = result.data[i];

                    // if medication does not exist in EHR then ehrMed is undefined
                    // which causes a problem when passing to React child components 
                    // therefore assigning empty data to ehr obj 
                    if(!result.data[i].ehrMed){ 
                        var temp = JSON.parse('{"medicationReference": {"display": ""},"dosageInstruction": [{"text": ""}]}');
                        data[i].ehrMed = temp;
                    }
                }

                this.setState(data);
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
                <ActionInfoList
                    MedicationPairs={this.state.medicationPairListResponse} token={token}
                />
            </div>
        )
    }
});

var ActionInfoList = React.createClass({
    getInitialState: function () {
        return {
            allMedications: []
        };
    },
    componentDidMount: function () {
        this.setState({allMedications: this.props.MedicationPairs});
    },
    render: function () {
        return (
                <div className='container med-list'>
                    <h2 className='title'>Actions list:</h2>
                    <div className='row header'>
                        <div className='col-xs-3'>
                            VA Medication
                        </div>
                        <div className='col-xs-3'>
                            Home Health
                        </div>
                        <div className='col-xs-2'>
                            Decision
                        </div>
                        <div className='col-xs-2'>
                            Home Health Actions Required
                        </div>
                    </div>
                    {this.state.allMedications.map(function (medication) {
                        return <ActionInfo Medications={medication.homeMed.name}
                                            hhMedDose={medication.homeMed.dose}
                                            hhMedNote={medication.homeMed.note}
                                            action={medication.homeMed.action}
                                            vaMed={medication.ehrMed.medicationReference.display}
                                            vaMedDose={medication.ehrMed.dosageInstruction[0].text}
                                             key={medication.homeMed._id}
                        />; // display each medication
                    })}
                </div>
        );
    }
});


var ActionInfo = React.createClass({
    getInitialState: function () {
        return {
            homeMedName : '',
            homeMedDose : '',
            homeMedNote : '',
            action : '',
            ehrMedName : '',
            ehrMedDose : ''
        };
    },
    componentDidMount: function () {
        this.setState({
            homeMedName : this.props.Medications,
            homeMedDose : this.props.hhMedDose,
            homeMedNote : this.props.hhMedNote,
            action : this.props.action,
            ehrMedName : this.props.vaMed,
            ehrMedDose : this.props.vaMedDose
        });
    },
    render: function () {
        return (
            <div className='row med'>
                <div className='col-xs-3'>
                    <span className='original-med-name'>{this.state.ehrMedName}</span>
                    <span className='col-xs-12'>{this.state.ehrMedDose}</span>
                </div>
                <div className='col-xs-3'>
                    <span className='original-med-name'>{this.state.homeMedName}</span>
                    <span className='col-xs-12'>{this.state.homeMedDose}</span>
                </div>
                <div className='col-xs-2'>
                    <span className='original-med-name'>{this.state.action}</span>
                </div>
                <div className='col-xs-2'>
                    <span className='original-med-name'>{this.state.homeMedNote}</span>
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
