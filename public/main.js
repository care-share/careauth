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
            name_first: 'default first name',
            name_last: 'default last name',
            email: 'default email',
            roles: 'default role',
            phone: 'default phone',
            fhir_id: 'default fhir id',
            contact_pref: 'default contact preference',
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
    //TODO add error message if field is bad
    validateField: function (key, value) {
        var obj = {};
        obj[key] = value;
        this.setState(obj);
        var errMsg = document.getElementById(key+'err');
        if (key === 'email') {
            if (validator.isEmail(value)) {
                this.setState({canSubmit: false});
                this.onUpdate(key, value);
                errMsg.innerHTML = '';
            } else {
                //TODO Add error message
                var text = document.getElementById(key);
                text.style.backgroundColor = 'red';
                this.setState({canSubmit : true});
                errMsg.innerHTML = 'invalid email';
            }
        } else if (key === 'phone') {
            if (validator.isMobilePhone(value, 'en-US')) {
                this.setState({canSubmit: false});
                this.onUpdate(key, value);
                errMsg.innerHTML = '';
            } else {
                var text = document.getElementById(key);
                text.style.backgroundColor = 'red';
                this.setState({canSubmit : true});
                errMsg.innerHTML = 'invalid phone';
            }
        } else if (key === 'name_first' || key === 'name_last') {
            var str = validator.trim(value);
            if(str !== ''){
                this.setState({canSubmit : false});
                this.onUpdate(key, value);
                errMsg.innerHTML = '';
            } else {
                var text = document.getElementById(key);
                text.style.backgroundColor = 'red';
                this.setState({canSubmit : true});
                errMsg.innerHTML = key + ' cannot be empty';
            }
        }
    },
    onUpdate: function (key, value) {
        var obj = {};
        obj[key] = value;
        this.setState(obj);
        this.props.updateList(key, value);
        var text = document.getElementById(key);
        if (this.state.initialMap[key] != obj[key]) {
            text.style.backgroundColor = 'green';
        }
        else {
            text.style.backgroundColor = 'white';
        }
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
                    <UserInfo label='First Name: ' keyName='name_first' data={this.state} type="text"
                              class="userInfoField editableField" onUpdate={this.validateField}/>
                    <UserInfo label='Last Name: ' keyName='name_last' data={this.state} type="text"
                              class="userInfoField editableField" onUpdate={this.validateField}/>
                    <UserInfo label='Email: ' keyName='email' data={this.state} type="email"
                              class="userInfoField editableField" onUpdate={this.validateField}/>
                    <UserInfo label='Roles: ' keyName='roles' data={this.state} canEdit={false} type="text"/>
                    <UserInfo label='Phone Number: ' keyName='phone' data={this.state} type="tel"
                              class="userInfoField editableField" onUpdate={this.validateField}/>
                    <UserPreferences onUpdate={this.onUpdate} pref={this.state.contact_pref}
                                     class="userInfoField editableField"/>
                    <UserInfo label='FHIR ID: ' keyName='fhir_id' data={this.state} type="text"
                              canEdit={false} onUpdate={this.onUpdate}/></tbody>
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
                <td><select value={this.props.pref} class={this.props.class} onChange={this.handleChange} disabled>
                    <option type="text" value="never">Never</option>
                    <option type="text" value="once a day">Once a day</option>
                    <option type="text" value="immediately">Immediately</option>
                </select>
                </td>
            </tr>
        )
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
            <tbody>
            <tr>
                <td>{this.props.label}</td>
                <td><input
                    type={this.props.type}
                    id={this.props.keyName}
                    value={this.props.data[this.props.keyName]}
                    onChange={this.handleChange}
                    className={this.props.class}
                    disabled></input></td>
                <td><label id={this.props.keyName + 'err'} value="Display"></label></td>
            </tr>
            </tbody>
        );
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
        $("#multiform").submit(function (e) {
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
        $("#multiform").submit();
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
                    <form name="multiform" id="multiform" encType="multipart/form-data" onSubmit={this.handleSubmit}>
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
