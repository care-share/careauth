/**
 * Created by Collin McRae
 * ver: 0.5
 * last modified: 12/30/2015
 */

//TODO: Add error messages to front-end
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

        for (var obj in this.state.diffMap) {
            var text = document.getElementById(obj);
            text.style.backgroundColor = 'white';
            delete this.state.diffMap[obj];
        }
    },
    clickEdit: function (event) {
        $( ".userInfoField.editableField" ).removeAttr('disabled');
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
                        var errMsg = document.getElementById(copy_obj+'err');
                        errMsg.innerHTML = "";
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        var text = document.getElementById(copy_obj);
                        text.style.backgroundColor = 'red';
                        var errMsg = document.getElementById(copy_obj+'err');
                        errMsg.innerHTML = copy_obj+': '+textStatus +' '+errorThrown;
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
    handleChange: function(event) {
        var obj = {};
        obj[event.target.name] = event.target.value;
        this.setState(obj);
        //this.props.updateList(key, value);
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
        $(".userInfoField.editableField").attr('disabled','true');
        this.props.clickCancel();
    },
    submitFields: function () {
        this.props.clickSubmit();
        this.loadServerData();
    },
    render: function () {
        return (
            <div>
                <ProfilePicture keyName="picture" userid={this.state.id}
                                token={this.props.token} data={this.state} canSee={this.props.isHidden}/>
                <br/>
                <form>
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
                                     class="userInfoField editableField" placeholder="Select your contact preference"/>
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
                    </tbody>
                    </table>
                    </form>
                    <button onClick={this.resetField} hidden={!this.props.isHidden}>Cancel</button>
                    <button onClick={this.submitFields} hidden={!this.props.isHidden}>Submit</button>
            </div>
        );
    }
});

var UserPreferences = React.createClass({
    handleChange: function (change) {
        this.props.onUpdate('contact_pref', change.target.value);
    },
    render: function () {
        return (

            <tr>
                <td>Contact Preference:</td>
                <td><select value={this.props.pref} className={this.props.class} onChange={this.handleChange} disabled>
                    <option type="text" value="never">Never</option>
                    <option type="text" value="once a day">Once a day</option>
                    <option type="text" value="immediately">Immediately</option>
                </select>
                </td>
            </tr>
        )
    }
});

//
//Add Password Edit button in order to enable editing
//Add Password submit button in order to submit password
//This works separately from the rest of User Edit
//Need to make AJAX request as well as place route into backend
//var PasswordHandler = React.createClass({
//   render: function (e) {
//       return (
//           <tbody hidden={!this.props.canEdit}>
//           <tr>
//               <td>Existing Password</td>
//               <td><textarea>Type it here!</textarea></td>
//           </tr>
//           <tr>
//               <td>New Password</td>
//               <td><textarea>Type it here!</textarea></td>
//           </tr>
//           <tr>
//               <td>Confirm Password</td>
//               <td><textarea>Type it here!</textarea></td>
//           </tr>
//           </tbody>
//       );
//   }
//});

var ProfilePicture = React.createClass({
    handleSubmit: function (e) {
        e.preventDefault();
    },
    handleChange: function (e) {
        var userid = this.props.userid;
        var url = '/users/' + userid + '/picture/';
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
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    //TODO add error message
                }
            });
            e.preventDefault(); //Prevent Default action.
            // e.unbind();
        });
        $("#pictureForm").submit();
        console.log(this.props.data[this.props.keyName]);
        this.forceUpdate();
    },
    render: function () {
        return (
            <div>
                <div>
                    <img
                        id={this.props.keyName}
                        src={"avatars/"+this.props.data[this.props.keyName]}></img>
                </div>
                <div hidden={!this.props.canSee}>
                    <form name="multiform" id="pictureForm" encType="multipart/form-data" onSubmit={this.handleSubmit}>
                        <input name="image" type="file" accept=".jpg"/>
                        <input type="submit" onClick={this.handleChange}/>
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
