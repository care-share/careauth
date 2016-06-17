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

// import external modules
var path = require('path');
var url = require('url');
var fs = require('fs');
var Q = require('q');
var HTTP = require('q-io/http');

// import internal modules
var app = require('./app');
var newUuid = require('./utils').newUuid;

function FhirCloner(baseUrlString, maxRecursion, maxObjectsPerResponse) {
    this.maxRecursion = (maxRecursion == null) ? 20 : maxRecursion;
    this.maxObjectsPerResponse = (maxObjectsPerResponse == null) ? 50 : maxObjectsPerResponse;
    this.baseUrlString = baseUrlString;

    this.inputOutputMapKeysWithoutPatient = ['Condition', 'Goal', 'ProcedureRequest', 'MedicationOrder', 'CarePlan'];
    this.inputOutputMapKeysWithPatient = this.inputOutputMapKeysWithoutPatient.slice();
    this.inputOutputMapKeysWithPatient.push('Patient');
}

FhirCloner.prototype.clonePatientMain = function (inputPatientId, outputPatientId) {
    this.inputPatientId = inputPatientId;
    this.outputPatientId = outputPatientId;
    if (!outputPatientId) {
        this.outputPatientId = newUuid(inputPatientId);
    }

    // data
    var inputMap = {};
    var oldToNewIdMap = {};

    // collect mapping from old id to new id (for patient object)
    oldToNewIdMap[inputPatientId] = this.outputPatientId;

    var basePatientUrlString = this.baseUrlString + '/Patient';
    var basePatientUrl = url.parse(basePatientUrlString);

    inputMap.Patient = [];
    inputMap.CarePlan = [];
    inputMap.Condition = [];
    inputMap.Goal = [];
    inputMap.MedicationOrder = [];
    inputMap.ProcedureRequest = [];

    var patientUrl = JSON.parse(JSON.stringify(basePatientUrl));
    patientUrl.query = {
        _id: inputPatientId,
        _count: this.maxObjectsPerResponse, // FHIR server limits count to 50 (larger than that won't have any effect)
        _format: 'json',
        _revinclude: ['CarePlan:patient', 'Condition:patient', 'Goal:patient', 'MedicationOrder:patient', 'ProcedureRequest:patient']
    };
    var patientUrlString = url.format(patientUrl);

    return this.pullDataFromFhir(patientUrlString, inputMap, 0, oldToNewIdMap);
};

FhirCloner.prototype.processLoadedData = function (inputMap, oldToNewIdMap) {

    var patientList = inputMap.Patient;
    var that = this;

// find list of patients (should be one) who will have their ids updated
    var targetPatients = patientList.filter(function (i) {
        return i.id === that.inputPatientId;
    });

// update the patient ids of those selected patient(s) [again, should only be one]
    targetPatients.forEach(function (i) {
        i.id = that.outputPatientId;
    });

    var remapObject = function (objectTypeName, patientId, oldToNewIdMap, patientReferenceParentField) {
        var objectList = inputMap[objectTypeName];
        var targetObjectList = objectList.filter(function (r) {
            return r[patientReferenceParentField].reference === ('Patient/' + patientId)
        });

        targetObjectList.forEach(function (r) {
            // capture old id
            var oldId = r.id;
            // generate new id
            var newId = newUuid(oldId);
            // assign new id
            r.id = newId;
            // update patient id reference
            var referenceParent = r[patientReferenceParentField];
            referenceParent.reference = 'Patient/' + that.outputPatientId;

            // collect mapping from old id to new id (for target procedure request)
            oldToNewIdMap[oldId] = newId;
        });

        return targetObjectList;
    };

    var remapCarePlan = function (objectTypeName, patientId, oldToNewIdMap, patientReferenceParentField) {
        var objectList = inputMap[objectTypeName];
        var targetObjectList = objectList.filter(function (r) {
            return r[patientReferenceParentField].reference === ('Patient/' + patientId)
        });

        targetObjectList.forEach(function (r) {
            // capture old id
            var oldId = r.id;
            // generate new id
            var newId = newUuid(oldId);
            // assign new id
            r.id = newId;
            // update patient id reference
            var referenceParent = r[patientReferenceParentField];
            referenceParent.reference = 'Patient/' + that.outputPatientId;

            var typeList = ['addresses', 'goal', 'activity'];
            typeList.forEach(function (t) {
                var currentElement = r[t];
                if (typeof currentElement === 'undefined') {
                    currentElement = [];
                }
                currentElement.forEach(function (i) {
                    // addresses and goal have arrays of objects where the reference property is the id,
                    // but activites have a reference object with a child reference object that need
                    //  an additional layer of dereference
                    var i2 = (t === 'activity') ? i.reference : i;

                    // get the old reference string that refers to a condition, goal, or procedure request.
                    var old = i2.reference;
                    var s = old.split('/');
                    var oldPrefix = s[0];
                    var oldSuffix = s[1];
                    // lookup the new id that should replace the old id
                    var newSuffix = oldToNewIdMap[oldSuffix];
                    var newIdString = oldPrefix + '/' + newSuffix;
                    i2.reference = newIdString;
                });
            });

            // collect mapping from old id to new id (for target procedure request)
            oldToNewIdMap[oldId] = newId;
        });

        return targetObjectList;
    };

    var targetProcedureRequests = remapObject('ProcedureRequest', this.inputPatientId, oldToNewIdMap, 'subject');
    var targetGoals = remapObject('Goal', this.inputPatientId, oldToNewIdMap, 'subject');

    var targetConditions = remapObject('Condition', this.inputPatientId, oldToNewIdMap, 'patient');
    var targetMedicationOrders = remapObject('MedicationOrder', this.inputPatientId, oldToNewIdMap, 'patient');

    var targetCarePlans = remapCarePlan('CarePlan', this.inputPatientId, oldToNewIdMap, 'subject');

    return {
        Patient: targetPatients,
        ProcedureRequest: targetProcedureRequests,
        Goal: targetGoals,
        Condition: targetConditions,
        MedicationOrder: targetMedicationOrders,
        CarePlan: targetCarePlans,
        Debug: {oldToNewIdMap: oldToNewIdMap}
    };
};

FhirCloner.prototype.pullDataFromFhir = function (patientUrlString, inputMap, currentRecursion, oldToNewIdMap) {
    var that = this;
    return HTTP.read(patientUrlString).then(function (response) {
        var json = JSON.parse(response);

        var responseEntryList = json.entry;
        responseEntryList.forEach(function (e) {
            var entryType = e.resource.resourceType;
            inputMap[entryType].push(e.resource);
        });

        var linkList = json.link;
        var linkObject = linkList.map(function (i) {
            return [i.relation, i];
        }).reduce(function (result, item) {
            var key = item[0];
            result[key] = item[1].url;
            return result;
        }, {});

        var nextLink = null;
        if (linkObject.hasOwnProperty('next')) {
            nextLink = linkObject.next;
        } else {
            var outputMap = that.processLoadedData(inputMap, oldToNewIdMap, that.outputPatientId);
            return that.saveAllToServer(outputMap, oldToNewIdMap);
        }

        if (currentRecursion < that.maxRecursion && nextLink !== null) {
            return that.pullDataFromFhir(nextLink, inputMap, currentRecursion + 1, oldToNewIdMap);
        }
    });
};

function stringify(s) {
    return JSON.stringify(s, null, 2)
}

FhirCloner.prototype.saveObjectToServer = function (objectType, o) {
    o = JSON.parse(JSON.stringify(o)); // clone the input object because we have to manipulate it (we don't want to change the original)
    var objectId = o.id;

    delete o.id; // we cannot have an ID in the PUT body object...
    var basePatientUrlString = this.baseUrlString + '/' + objectType + '/' + objectId;
    var basePatientUrl = url.parse(basePatientUrlString);

    var objectRequest = JSON.parse(JSON.stringify(basePatientUrl));

    objectRequest.method = 'PUT';
    objectRequest.headers = {
        'Accepts': 'application/json+fhir',
        'Content-Type': 'application/json+fhir'
    };
    var objectDataString = stringify(o);
    objectRequest.body = [objectDataString];

    return HTTP.request(objectRequest).then(function (response) {
        var code = response.status;
        if (code === 200 || code === 201) {
            app.logger.verbose('fhir_cloner: PUT succeeded (%s) for %s/%s', code, o.resourceType, objectId);
        } else {
            app.logger.error('fhir_cloner: PUT failed (%s) for %s/%s', code, o.resourceType, objectId);
        }
    }, function (err) {
        app.logger.error('fhir_cloner: PUT failed for %s/%s:', o.resourceType, objectId, err.message);
    });
};

FhirCloner.prototype.saveAllToServer = function (outputMap, oldToNewIdMap) {
    var processingBlocks = {beginning: [], middle: [], end: []};

    this.inputOutputMapKeysWithPatient.forEach(function (k) {
        var block = 'middle';
        switch (k) {
            case 'Patient':
                block = 'beginning';
                break;
            case 'CarePlan':
                block = 'end';
                break;
            default:
                block = 'middle';
                break;
        }

        var entriesForCurrentType = outputMap[k];
        entriesForCurrentType.forEach(function (currentObject) {
            processingBlocks[block].push({objectType: k, object: currentObject});
        });

    });

    var beginningBlock = processingBlocks.beginning;
    var middleBlock = processingBlocks.middle;
    var endBlock = processingBlocks.end;

    var that = this;
    var invokeSetOfSaveRequests = function (setOfObjects) {
        var allPromiseArray = setOfObjects.map(function (i) {
            return that.saveObjectToServer(i.objectType, i.object);
        });
        return Q.all(allPromiseArray);
    };

    return invokeSetOfSaveRequests(beginningBlock)
        .thenResolve(middleBlock)
        .then(invokeSetOfSaveRequests)
        .thenResolve(endBlock)
        .then(invokeSetOfSaveRequests)
        .thenResolve(oldToNewIdMap);
};

module.exports = FhirCloner;
