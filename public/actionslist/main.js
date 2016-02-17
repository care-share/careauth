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
        //   http://api.domain:3000/actionslist?token=abc&patient_id=xyz
        var token = getUrlParameter('token');
        var patient_id = getUrlParameter('patient_id');
        // TODO: validate that token and patient_id are not null
 
        var mongodbPath = '/medentries/patient_id/' + patient_id;

        console.log('Requesting data from mongoDB at: ' + mongodbPath);
        $.ajax({
            type: 'GET',
            url: mongodbPath,
            dataType: 'json',
            headers: {'X-Auth-Token': token},
            success: function (result) {
                console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                var data = [];
                for(var i = 0; i < result.data.length; i++){
                    data.push(result.data[i]);
                }
                console.log('data = ' + JSON.stringify(data));
                this.setState({medication_list_response: data});
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
                    Medications={this.state.medication_list_response} token={token}
                />
            </div>
        )
    }
});

var ActionInfoList = React.createClass({
    getInitialState: function () {
        return {
            allMedications: [],
            id: 10000000,
            addHiddem: false,
            submitHidden: false
        };
    },
    componentDidMount: function () {
        this.setState({allMedications: this.props.Medications});
    },
    render: function () {
        console.log('all meds:' + this.state.allMedications);
        return (
                <div className='container med-list'>
                    <h2 className='title'>Actions list:</h2>
                    <div className='row header'>
                        <div className='col-xs-2'>
                            VA Medication
                        </div>
                        <div className='col-xs-1'>
                            Home Health 
                        </div>
                        <div className='col-xs-2'>
                            Decision
                        </div>
                        <div className='col-xs-2'>
                            Home Health Actions Required
                        </div>
                    </div>
                </div>
        );
    }
});


var ActionInfo = React.createClass({
    getInitialState: function () {
        return {
        };
    },
    componentDidMount: function () {

    },
    render: function () {
        // IMPORTANT NOTE: for server-side processing to work correctly, med_name MUST be the first form field!
        return (
            <div> placeholder
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
