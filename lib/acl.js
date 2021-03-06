/*
 * Copyright 2016 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// import external modules
var acl = require('acl');

module.exports = function () {
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
    // FHIR resources grouped by category
    // https://www.hl7.org/fhir/resourcelist.html
    var clinicalResources = [
      // General
        'AllergyIntolerance',
        'Condition',
        'Procedure',
        'ClinicalImpression',
        'FamilyMemberHistory',
        'RiskAssessment',
        'DetectedIssue',
      // Care Provision
        'CarePlan',
        'Goal',
        'ReferralRequest',
        'ProcedureRequest',
        'NutritionOrder',
        'VisionPrescription',
      // Medication & Immunization
        'Medication',
        'MedicationOrder',
        'MedicationAdministration',
        'MedicationDispense',
        'MedicationStatement',
        'Immunization',
        'ImmunizationRecommendation',
      // Diagnostics
        'Observation',
        'DiagnosticReport',
        'DiagnosticOrder',
        'Specimen',
        'BodySite',
        'ImagingStudy',
        'ImagingObjectSelection'
    ], identificationResources = [
      // Individuals
        'Patient',
        'Practitioner',
        'RelatedPerson',
      // Groups
        'Organization',
        'HealthcareService',
        'Group',
      // Entities
        'Location',
        'Substance',
        'Person',
        'Contract',
      // Devices
        'Device',
        'DeviceComponent',
        'DeviceMetric'
    ], workflowResources = [
      // Patient Management
        'Encounter',
        'EpisodeOfCare',
        'Communication',
        'Flag',
      // Scheduling
        'Appointment',
        'AppointmentResponse',
        'Schedule',
        'Slot',
      // Workflow #1
        'Order',
        'OrderResponse',
        'CommunicationRequest',
        'DeviceUseRequest',
        'DeviceUseStatement',
      // Workflow #2
        'ProcessRequest',
        'ProcessResponse',
        'SupplyRequest',
        'SupplyDelivery'
    ], infrastructureResources = [
      // Information Tracking
        'Questionnaire',
        'QuestionnaireResponse',
        'Provenance',
        'AuditEvent',
      // Documents & Lists
        'Composition',
        'DocumentManifest',
        'DocumentReference',
        'List',
      // Structure
        'Media',
        'Binary',
        'Bundle',
        'Basic',
      // Exchange
        'MessageHeader',
        'OperationOutcome',
        'Parameters',
        'Subscription'
    ], conformanceResources = [
      // Terminology
        'ValueSet',
        'ConceptMap',
        'NamingSystem',
      // Content
        'StructureDefinition',
        'DataElement',
      // Operations Control
        'Conformance',
        'OperationDefinition',
        'SearchParameter',
      // Misc
        'ImplementationGuide',
        'TestScript'
    ], financialResources = [
      // Support
        'Coverage',
        'EligibilityRequest',
        'EligibilityResponse',
        'EnrollmentRequest',
        'EnrollmentResponse',
      // Billing
        'Claim',
        'ClaimResponse',
      // Payment
        'PaymentNotice',
        'PaymentReconciliation',
      // Other
        'ExplanationOfBenefit'
    ];

    // very simple hard-coded ACL
    // permissions cover all FHIR resources and all methods in the FHIR RESTful API
    // https://www.hl7.org/fhir/http.html#summary
    var allResources = clinicalResources.concat(
        identificationResources,
        workflowResources,
        infrastructureResources,
        conformanceResources,
        financialResources
    );
    acl.allow(
        [{
            roles: ['user', 'physician'],
            allows: [{
                resources: allResources,
                permissions: [
                    'get', // read, vread, search, variant searches, history
                    'options' // conformance
                ]
            }]
        }, {
            roles: 'physician',
            allows: [{
                resources: allResources,
                permissions: [
                    'put', // update, conditional update
                    'delete', // delete, conditional delete
                    'post' // create, conditional create
                ]
            }]
        }
    ]);

    var whitelistedUserAttrs = {
        'Goal': [
            'addresses'
        ]
    };
    // process PUT requests for HH users, apply a whitelist of specific attributes
    // returns a boolean, indicates whether or not any attributes were applied
    acl.processAttrs = function (existing, proposed) {
        var changed = false;
        var resType = existing.resourceType;
        var attrs = whitelistedUserAttrs[resType];

        if (attrs) {
            for (var i = 0; i < attrs.length; i++) {
                var attr = attrs[i];
                var before = JSON.stringify(existing[attr]);
                var after = JSON.stringify(proposed[attr]);
                if (before !== after) {
                    existing[attr] = proposed[attr];
                    changed = true;
                }
            }
        }

        return changed;
    }
}
