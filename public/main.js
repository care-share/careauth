/**
 * Created by Collin McRae
 * ver: 0.3
 * last modified: 12/24/2015
 */

//TODO: Update ViewPage Documentation
//TODO: When email gets updated point to new URL

/**
 * The entire view of the User Information page
 * Creates a <div> containing Header, UserInfoList object
 * Owns UserInfoList
 * Rendered at the end of code
 * @method getInitialState sets initial state of diffMap and editHidden
 */
var ViewPage = React.createClass({
    getInitialState: function () {
        return {
            diffMap: {},
            editHidden: false
        };
    },
    clickEdit: function (event) {
        this.setState({
            editHidden: !this.state.editHidden
        });
    },
    clickSubmit: function (event) {
        this.setState({
            editHidden: !this.state.editHidden
        });
        var token = this.getUrlParameter('token');
        //From token I need to get ID
        var decoded = jwt_decode(token);
        var userid = decoded.sub;
        for (var obj in this.state.diffMap) {
            var url = '/users/' + userid + '/' + obj + '/' + this.state.diffMap[obj];
            (function (copy_obj) {
                $.ajax({
                    url: url,
                    method: 'PUT',
                    headers: {'X-Auth-Token': token},
                    success: function (data, textStatus, jqXHR) {
                        var text = document.getElementById(copy_obj);
                        text.style.backgroundColor = 'white';
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        var text = document.getElementById(copy_obj);
                        text.style.backgroundColor = 'red';
                    }
                });
            }(obj))
            delete this.state.diffMap[obj];
        }
    },
    addToList: function (key, value) {
        var newMap = this.state.diffMap;
        newMap[key] = value;
        this.setState({
            diffMap: newMap
        });
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
        var token = this.getUrlParameter('token');
        var url = '/users/self';
        return (
            <div>
                <h1>User Information</h1>
                <UserInfoList source={url} token={token} isHidden={this.state.editHidden} updateList={this.addToList}/>
                <button onClick={this.clickEdit} hidden={this.state.editHidden}>Edit User</button>
                <button onClick={this.clickSubmit} hidden={!this.state.editHidden}>Submit</button>
            </div>
        );
    }
});

/**
 * Creates several UserInfo objects in a <div>
 * @param this.props.source passes in a JSON object to be parsed.
 * @method getInitialState sets initial state of all information to be passed to UserInfo
 * @method componentDidMount checks to see if component is mounted
 * if so, makes an ajax call on the source parameter
 * if success reads JSON file and sets state of all information to be passed to UserInfo
 * if error logs information in the console
 * @method onUpdate updates the state of all UserInfoList objects.
 * Called from UserInfo when a change occurs in textarea
 * Calls updateList in ViewPage to update list of changes to be returned to server
 * @method render creates a <div> containing userInfo objects
 */
var UserInfoList = React.createClass({
    getInitialState: function () {
        return {
            name_first: 'default first name',
            name_last: 'default last name',
            email: 'default email',
            roles: 'default role',
            phone: 'default phone',
            fhir_id: 'default fhir id',
            contact_pref: 'default contact preference',
            picture: 'default_picture.jpg'
        };
    },
    componentDidMount: function () {
        $.ajax({
            url: this.props.source,
            dataType: 'json',
            cache: false,
            headers: {'X-Auth-Token': this.props.token},
            success: function (result) {
                this.setState({
                    name_first: result.data.name_first,
                    name_last: result.data.name_last,
                    email: result.data.email,
                    roles: result.data.roles.toString(),
                    phone: result.data.phone,
                    fhir_id: result.data.fhir_id,
                    contact_pref: result.data.contact_pref,
                    picture: result.data.picture,
                    id: result.data._id
                });
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(this.props.source, status, err.toString());
            }.bind(this)
        });
    },
    onUpdate: function (key, value) {
        var obj = {};
        obj[key] = value;
        this.setState(obj);
        this.props.updateList(key, value);
        var text = document.getElementById(key);
        text.style.backgroundColor = 'green';
    },
    render: function () {
        return (
            <div>
                <ProfilePicture keyName="picture" userid={this.state.id} data={this.state} canSee={this.props.isHidden}/>
                <UserInfo type='First Name: ' keyName='name_first' data={this.state} canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
                <UserInfo type='Last Name: ' keyName='name_last' data={this.state} canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
                <UserInfo type='Email: ' keyName='email' data={this.state} canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
                <UserInfo type='Roles: ' keyName='roles' data={this.state} canEdit={false}/>
                <UserInfo type='Phone Number: ' keyName='phone' data={this.state} canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
                <UserInfo type='Contact Preference: ' keyName='contact_pref' data={this.state}
                          canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
                <UserInfo type='FHIR ID: ' keyName='fhir_id' data={this.state} canEdit={this.props.isHidden}
                          onUpdate={this.onUpdate}/>
            </div>
        );
    }
});


/**
 * UserInfo is a React component used to display user information in a <textarea>
 * updates from these <textarea>'s are passed up to UserInfoList and update state
 *@param this.props.canEdit used to see if textarea is editable
 *@param this.props.type used to label the type of data being displayed
 *@param this.props.data sets the data to be displayed
 *@param this.props.keyName used to select the correct state to display and edit
 *@method handleChange updates state from parent using change.target.value
 *@method render creates a <div> containing a read-only <textarea>
 */
var UserInfo = React.createClass({
    handleChange: function (change) {
        this.props.onUpdate(this.props.keyName, change.target.value);
    },
    render: function () {
        return (
            <div>
                {this.props.type}
                <textarea
                    id={this.props.keyName}
                    value={this.props.data[this.props.keyName]}
                    onChange={this.handleChange}
                    readOnly={!this.props.canEdit}
                    style={{backgroundColor: "white"}}
                    rows="1" cols="20"></textarea>
            </div>
        );
    }
});

var ProfilePicture = React.createClass({
    //Make this an ajax request
    render: function () {
        return (
            <div>
                <div>
                    <img
                        id={this.props.keyName}
                        src={"avatars/"+this.props.data[this.props.keyName]}></img>
                </div>
                <div hidden={!this.props.canSee}>
                    <form encType="multipart/form-data" action={"/users/" +
                    this.props.userid + "/picture"} method="POST">
                        <input name="image" type="file" accept=".jpg" />
                        <input type="submit" value="Upload Image"/>
                    </form>
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
