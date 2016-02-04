/**
 * Created by Collin McRae
 * ver: 0.8
 * last modified: 2/02/2016
 */

//TODO: Add documentation for new elements, update documentation for old elements

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
    clickCancel: function (event) {
        this.setState({
            editHidden: !this.state.editHidden,
        });
    },
    clickEdit: function (event) {
        $(".userInfoField.editableField").removeAttr('disabled');
        this.setState({
            editHidden: !this.state.editHidden
        });
    },
    clickSubmit: function (event) {
        $(".userInfoField.editableField").attr('disabled', 'true');
        this.setState({
            editHidden: !this.state.editHidden
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
                <UserInfoList
                    source={url} token={token}
                    isHidden={this.state.editHidden} updateList={this.addToList}
                    clickCancel={this.clickCancel}
                    clickSubmit={this.clickSubmit}
                />
                <button onClick={this.clickEdit} hidden={this.state.editHidden}>Edit User</button>
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
            name_first: '',
            name_last: '',
            email: '',
            roles: '',
            phone: '',
            fhir_id: '',
            contact_pref: '',
            picture: 'default_picture.jpg',
            canSubmit: false,
            initialMap: {}
        };
    },
    loadServerData: function () {
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
                    id: result.data._id,
                    initialMap: {
                        name_first: result.data.name_first,
                        name_last: result.data.name_last,
                        email: result.data.email,
                        roles: result.data.roles,
                        phone: result.data.phone,
                        fhir_id: result.data.fhir_id,
                        contact_pref: result.data.contact_pref
                    }
                });
            }.bind(this),
            error: function (xhr, status, err) {
                console.error(this.props.source, status, err.toString());
            }.bind(this)
        });
    },
    componentDidMount: function () {
        this.loadServerData();
    },
    handleChange: function (event) {
        var obj = {};
        obj[event.target.name] = event.target.value;
        this.setState(obj);
    },
    resetField: function () {
        this.setState({
            name_first: this.state.initialMap["name_first"],
            name_last: this.state.initialMap["name_last"],
            email: this.state.initialMap["email"],
            roles: this.state.initialMap["roles"],
            phone: this.state.initialMap["phone"],
            fhir_id: this.state.initialMap["fhir_id"],
            contact_pref: this.state.initialMap["contact_pref"]
        });
        $(".userInfoField.editableField").attr('disabled', 'true');
        this.props.clickCancel();
    },
    submitChanges: function (e) {
        var userid = this.state.id;
        var token = this.props.token;
        var reactObj = this;
        var prefurl = "users/" + userid + "/contact_pref/" + this.state.contact_pref;

        function submit() {
            reactObj.loadServerData();
            reactObj.props.clickSubmit();
        }

        $('#myform').submit(function () {
            var frm = $(this);
            var dat = JSON.stringify(frm.serializeArray());
            var url = "users/" + userid + "/update";

            console.log("I am about to POST this:\n\n" + dat);
            $.ajax({
                type: "POST",
                url: url,
                headers: {'X-Auth-Token': token},
                data: dat,
                success: function (result) {
                    console.log('SUCCESS! ' + JSON.stringify(result, null, 2));
                    submit(result);
                },
                dataType: "json",
                contentType: "application/json"
            });
        });
    },
    handleSubmit: function (e) {
        e.preventDefault();
    },
    render: function () {
        return (
            <div>
                <ProfilePicture keyName="picture" userid={this.state.id}
                                token={this.props.token} data={this.state} canSee={this.props.isHidden}/>
                <br/>
                <PasswordHandler token={this.props.token} userid={this.state.id} isHidden={this.props.isHidden}/>
                <br/>
                <form id="myform" onSubmit={this.handleSubmit}>
                    <table>
                        <tbody>
                        <tr>
                            <td>First Name:</td>
                            <td>
                                <input
                                    name="name_first"
                                    placeholder="Enter your first name"
                                    type="text"
                                    value={this.state.name_first}
                                    required
                                    disabled
                                    onChange={this.handleChange}
                                    className="userInfoField editableField"
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>Last Name:</td>
                            <td>
                                <input
                                    name="name_last"
                                    placeholder="Enter your last name"
                                    type="text"
                                    onChange={this.handleChange}
                                    value={this.state.name_last}
                                    required
                                    disabled
                                    className="userInfoField editableField"
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>Email:</td>
                            <td>
                                <input
                                    name="email"
                                    placeholder="Enter your email"
                                    type="email"
                                    value={this.state.email}
                                    onChange={this.handleChange}
                                    required
                                    disabled
                                    className="userInfoField editableField"
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>Roles:</td>
                            <td>
                                <input
                                    placeholder="No roles exist"
                                    type="text"
                                    value={this.state.roles}
                                    disabled
                                    className="userInfoField"
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>Phone:</td>
                            <td>
                                <input
                                    name="phone"
                                    placeholder="Enter your phone"
                                    type="tel"
                                    onChange={this.handleChange}
                                    value={this.state.phone}
                                    required
                                    disabled
                                    className="userInfoField editableField"
                                ></input>
                            </td>
                        </tr>
                        <UserPreferences pref={this.state.contact_pref}
                                         handleChange = {this.handleChange}
                                         class="userInfoField editableField"
                                         placeholder="Select your contact preference"/>
                        <tr>
                            <td>FHIR ID:</td>
                            <td>
                                <input
                                    placeholder="No fhir id exists"
                                    type="text"
                                    value={this.state.fhir_id}
                                    required
                                    disabled
                                    className="userInfoField"
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <input type="submit" onClick={this.submitChanges} hidden={!this.props.isHidden} value="submit changes"></input>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </form>
                <button onClick={this.resetField} hidden={!this.props.isHidden}>cancel</button>
            </div>
        );
    }
});

var UserPreferences = React.createClass({
    handleChange: function (change) {
        this.props.handleChange(change);
    },
    render: function () {
        return (

            <tr>
                <td>Contact Preference:</td>
                <td><select value={this.props.pref} className={this.props.class} name="contact_pref" onChange={this.handleChange} disabled>
                    <option type="text" value="never">Never</option>
                    <option type="text" value="once a day">Once a day</option>
                    <option type="text" value="immediately">Immediately</option>
                </select>
                </td>
            </tr>
        )
    }
});


var PasswordHandler = React.createClass({
    getInitialState: function() {
        return {
            existing_password: '',
            new_password: '',
            confirm_password: '',
            validation_err: false
        };
    },
    clearState: function() {
        this.setState({
            existing_password: '',
            new_password: '',
            confirm_password: '',
            validation_err: false
        });
    },
    submitChanges: function (e) {
        var userid = this.props.userid;
        var token = this.props.token;
        function emptyFields(){
            this.clearState();
        }
        if(this.state.new_password === this.state.confirm_password){
            $('#passform').unbind('submit').bind('submit',function () {
                var frm = $(this);
                var dat = JSON.stringify(frm.serializeArray());
                var url = "users/" + userid + "/password";

                console.log("I am about to POST this:\n\n" + dat);
                //Catch Response, update state
                $.ajax({
                    type: "POST",
                    url: url,
                    headers: {'X-Auth-Token': token},
                    data: dat,
                    success: function () {
                        console.log('SUCCESS');
                        emptyFields();
                    },
                    dataType: "json",
                    contentType: "application/json"
                });
            });
        } else {
            this.clearState();
            this.setState({
                validation_err : true
            });
        }

    },
    handleChange: function (event) {
        var obj = {};
        obj[event.target.name] = event.target.value;
        this.setState(obj);
    },
    handleSubmit: function (e) {
        e.preventDefault();
    },
    render: function () {
        return (
            <form id="passform" hidden={!this.props.isHidden} onSubmit={this.handleSubmit}>
                <table>
                    <tbody>
                    <tr>
                        <td>Existing Password: </td>
                        <td><input value={this.state.existing_password} onChange={this.handleChange}
                                   className="userInfoField editableField passwordField" required type="password"
                                   placeholder="Enter existing password" name="existing_password"></input></td>
                    </tr>
                    <tr>
                        <td>New Password: </td>
                        <td><input value={this.state.new_password} onChange={this.handleChange}
                                   className="userInfoField editableField passwordField" required type="password"
                                   placeholder="Enter new password" name="new_password"></input></td>
                    </tr>
                    <tr>
                        <td>Confirm Password: </td>
                        <td><input value={this.state.confirm_password} onChange={this.handleChange}
                                   className="userInfoField editableField passwordField" required type="password"
                                   placeholder="Confirm new password" name="confirm_password"></input></td>
                        <td><span hidden={!this.state.validation_err}>passwords do not match</span></td>
                    </tr>
                    <tr>
                        <td>
                            <input type="submit" value="submit password" onClick={this.submitChanges}></input>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </form>
        );
    }
});

var ProfilePicture = React.createClass({
    handleSubmit: function (e) {
        e.preventDefault();
    },
    handleChange: function (e) {
        var userid = this.props.userid;
        var url = '/profile/users/' + userid + '/picture';
        var token = this.props.token;
        $("#pictureForm").submit(function (e) {
            var formObj = $(this);
            var formData = new FormData(this);
            $.ajax({
                url: url,
                type: 'POST',
                data: formData,
                mimeType: 'multipart/form-data',
                contentType: false,
                headers: {'X-Auth-Token': token},
                cache: false,
                processData: false,
                success: function (data, textStatus, jqXHR) {
                    //TODO add success message
                    console.log("Success! Picture has been updated!");
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Error: " +errorThrown);
                    //TODO add error message
                }
            });
            e.preventDefault(); //Prevent Default action.
            // e.unbind();
        });
        //$("#pictureForm").submit();
        console.log(this.props.data[this.props.keyName]);
        this.forceUpdate();
    },
    render: function () {
        return (
            <div>
                <div>
                    <img
                        id={this.props.keyName}
                        src={"/avatars/"+this.props.data[this.props.keyName]}></img>
                </div>
                <div hidden={!this.props.canSee}>
                    <form name="multiform" id="pictureForm" encType="multipart/form-data" onSubmit={this.handleSubmit}>
                        <input name="image" type="file" accept=".jpg"/>
                        <input type="submit" value="submit picture" onClick={this.handleChange}/>
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
