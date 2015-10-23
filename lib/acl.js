'use strict';

// import external modules
var acl = require('acl');

module.exports = function() {
    // Simple roles:
    //  * user:
    //    * can read but not write FHIR data
    //    * cannot read/write API data
    //  * physician:
    //    * can read/write FHIR data
    //    * cannot read/write API data
    // An account may be associated with one or more roles
    // Permissions are enumerated additively (e.g. a user who is also a physician may read/write FHIR data)

    // since we're loading a hard-coded ACL, use the in-memory backend
    // we also have the option of using Mongo if we add an ACL interface at some point
    var aclObj = new acl(new acl.memoryBackend());
    populateAcl(aclObj);
    return aclObj;
};

function populateAcl(acl) {
    var allFhirResources = [
        '/Condition',
        '/Encounter',
        '/Medication',
        '/MedicationOrder',
        '/Organization',
        '/Patient',
        '/Practitioner',
        // TODO: add more resources here
    ];

    // very simple hard-coded ACL
    // permissions cover all methods in the FHIR RESTful API
    // https://www.hl7.org/fhir/http.html#summary
    acl.allow(
        [{
            roles: ['user', 'physician'],
            allows: [{
                resources: allFhirResources,
                permissions: [
                    'get', // read, vread, search, variant searches, history
                    'options' // conformance
                ]
            }]
        }, {
            roles: 'physician',
            allows: [{
                resources: allFhirResources,
                permissions: [
                    'put', // update, conditional update
                    'delete', // delete, conditional delete
                    'post' // create, conditional create
                ]
            }]
        }
    ]);
}
