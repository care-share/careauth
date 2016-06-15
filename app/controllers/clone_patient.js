#!/usr/bin/env node

// dependencies
const path = require('path');
const url = require('url');
const fs = require("fs");

const Q = require("q");
const HTTP = require('q-io/http');

const uuid = require("node-uuid");

function FhirCloner()
{
    var configString = fs.readFileSync("clone_patient_config.json", {encoding: "UTF-8"});
    this.config = JSON.parse(configString);

    this.maxRecursion = this.config.hasOwnProperty("maxRecursion") ? this.config.maxRecursion : 10;
    this.maxObjectsPerResponse =
        this.config.hasOwnProperty("maxObjectsPerResponse") ? this.config.maxObjectsPerResponse : 10;

    this.baseUrlString = this.config.baseUrlString;

    console.log("base url string: " + this.baseUrlString);
    console.log("max recursion: " + this.maxRecursion);
    console.log("max objects per response: " + this.maxObjectsPerResponse);

    this.inputOutputMapKeysWithoutPatient = ["Condition", "Goal", "ProcedureRequest", "MedicationOrder", "CarePlan"];
    this.inputOutputMapKeysWithPatient = this.inputOutputMapKeysWithoutPatient.slice();
    this.inputOutputMapKeysWithPatient.push("Patient");


    console.log("BEGINNING of clone patient...");

    this.currentSequenceNumberForPatientMap = {};
}

FhirCloner.prototype.clonePatient =
  function(inputPatientId) {
      
  };

// ***** MAIN CALL *****
//clonePatientMain(inputPatientId, outputPatientId);
// ***** MAIN CALL *****



FhirCloner.prototype.generateNewPatientId = function()
{
    var currentTimestampMs = (new Date()).getTime();
    var currentSequenceNumber = 0;
    var currentPatientIdSuffix = this.calculatePatientIdSuffix(currentTimestampMs);
    var newId = "" + currentTimestampMs + currentPatientIdSuffix;
    
    this.currentSequenceNumberForPatientMap[newId] = 0;
    
    return newId;
}

FhirCloner.prototype.setupSpecifiedNewPatientId = function(newId)
{
    
    this.currentSequenceNumberForPatientMap[newId] = 0;
    
    return newId;
}



FhirCloner.prototype.calculatePatientIdSuffix = function(timestampMs)
{
    return "-" + uuid.v4();
}

FhirCloner.prototype.calculateNextSubidForPatient = function(patientId)
{
    var sequenceNumber = this.currentSequenceNumberForPatientMap[patientId]++;
    var sequenceLetter = this.calculateLetterSequence(sequenceNumber);
    var newSubid = patientId + sequenceLetter;
    return newSubid;
}

FhirCloner.prototype.clonePatient =
function clonePatientMain(inputPatientId, outputPatientId)
{

    if (outputPatientId)
    {
        this.setupSpecifiedNewPatientId(outputPatientId);
    } else
    {
        this.outputPatientId = this.generateNewPatientId();
    }

    console.log("%%% input (source) patient id: " + inputPatientId);
    console.log("%%% output (new) patient id: " + outputPatientId);
    
    console.log("beginning of processing");

    // data
    var queue = []; // FIFO
    var inputMap = {};
    var oldToNewIdMap = {};

    // collect mapping from old id to new id (for patient object)
    oldToNewIdMap[inputPatientId] = outputPatientId;

    console.log("switch inputMethod: " + this.config.inputMethod);

    switch (this.config.inputMethod)
    {
        case "file":
            console.log("reading from file...");
            //readData('organizations.json');
            //readData('practitioners.json');
            readData('patients.json');
            readData('conditions.json');
            readData('goals.json');
            readData('procedureRequests.json');
            //readData('nutritionOrders.json');
            //readData('medications.json');
            readData('medicationOrders.json');
            readData('carePlans.json');

            var outputMap = processLoadedData(inputMap, oldToNewIdMap, outputPatientId);

            break;

        case "server":
            console.log("reading from server...");
            var basePatientUrlString = this.baseUrlString + 'Patient';
            var basePatientUrl = url.parse(this.basePatientUrlString);

            inputMap.Patient = [];
            inputMap.CarePlan = [];
            inputMap.Condition = [];
            inputMap.Goal = [];
            inputMap.MedicationOrder = [];
            inputMap.ProcedureRequest = [];

            var patientUrl = JSON.parse(JSON.stringify(basePatientUrl));
            patientUrl.query =
                {
                    "_id": inputPatientId,
                    "_count": maxObjectsPerResponse, // FHIR server limits count to 50 (larger than that won't have any effect)
                    "_format": "json",
                    "_revinclude": ["CarePlan:patient", "Condition:patient", "Goal:patient", "MedicationOrder:patient", "ProcedureRequest:patient"]
                };
            var patientUrlString = url.format(patientUrl);

            this.pullDataFromFhir(patientUrlString, inputMap, 0, oldToNewIdMap, outputPatientId);

            break;
        default:
            console.log("WARNING: no inputMethod specified!!!");
            break;
    }
    
    return oldToNewIdMap;

}

FhirCloner.prototype.processLoadedData = function(inputMap, oldToNewIdMap, outputPatientId)
{

var patientList = inputMap.Patient;

// find list of patients (should be one) who will have their ids updated
var targetPatients = patientList.filter(function(i) { return i.id === inputPatientId; });

console.log("typeof targetPatients1: " + (typeof targetPatients));

// update the patient ids of those selected patient(s) [again, should only be one]
targetPatients.forEach(function(i) { i.id = outputPatientId; });

console.log("typeof targetPatients1b: " + (typeof targetPatients));

var remapObject = function(objectTypeName, patientId, oldToNewIdMap, patientReferenceParentField)
{
    var objectList = inputMap[objectTypeName];
    var targetObjectList = objectList.filter(function(r) { return r[patientReferenceParentField].reference === ("Patient/" + patientId) });

    targetObjectList.forEach(function(r)
      {
        // capture old id
        var oldId = r.id;
        // generate new id
        var newId = calculateNextSubidForPatient(outputPatientId);
        // assign new id
        r.id = newId;
        // update patient id reference
        var referenceParent = r[patientReferenceParentField];
        referenceParent.reference = "Patient/" + outputPatientId;

        // collect mapping from old id to new id (for target procedure request)
        oldToNewIdMap[oldId] = newId;
      });

    return targetObjectList;
};

var remapCarePlan = function(objectTypeName, patientId, oldToNewIdMap, patientReferenceParentField)
{
    var objectList = inputMap[objectTypeName];
    var targetObjectList = objectList.filter(function(r) { return r[patientReferenceParentField].reference === ("Patient/" + patientId) });

    targetObjectList.forEach(function(r)
      {
        // capture old id
        var oldId = r.id;
        // generate new id
        var newId = calculateNextSubidForPatient(outputPatientId);
        // assign new id
        r.id = newId;
        // update patient id reference
        var referenceParent = r[patientReferenceParentField];
        referenceParent.reference = "Patient/" + outputPatientId;

        var typeList = ["addresses", "goal", "activity"];
        typeList.forEach(function(t)
        {
            var currentElement = r[t];
            if (typeof currentElement === "undefined") { currentElement = []; }
            currentElement.forEach(function(i)
            {
              // addresses and goal have arrays of objects where the reference property is the id,
              // but activites have a reference object with a child reference object that need
              //  an additional layer of dereference
              var i2 = (t === "activity") ? i.reference : i;

              // get the old reference string that refers to a condition, goal, or procedure request.
              var old = i2.reference;
              var s = old.split("/");
              var oldPrefix = s[0];
              var oldSuffix = s[1];
              // lookup the new id that should replace the old id
              var newSuffix = oldToNewIdMap[oldSuffix];
              var newIdString = oldPrefix + "/" + newSuffix;
              i2.reference = newIdString;
            });
        });

        // collect mapping from old id to new id (for target procedure request)
        oldToNewIdMap[oldId] = newId;
      });

    return targetObjectList;
};

var targetProcedureRequests = remapObject("ProcedureRequest", inputPatientId, oldToNewIdMap, "subject");
var targetGoals = remapObject("Goal", inputPatientId, oldToNewIdMap, "subject");

var targetConditions = remapObject("Condition", inputPatientId, oldToNewIdMap, "patient");
var targetMedicationOrders = remapObject("MedicationOrder", inputPatientId, oldToNewIdMap, "patient");

var targetCarePlans = remapCarePlan("CarePlan", inputPatientId, oldToNewIdMap, "subject");

var outputMap =
    {
        Patient: targetPatients,
        ProcedureRequest: targetProcedureRequests,
        Goal: targetGoals,
        Condition: targetConditions,
        MedicationOrder: targetMedicationOrders,
        CarePlan: targetCarePlans,
        Debug: { oldToNewIdMap: oldToNewIdMap }
    };

console.log("before server output");
console.log("typeof targetPatients3: " + (typeof targetPatients));
console.log("after server output");


console.log("=== INPUT JSON DATA/begin ===");
console.log("(omitted)");
//console.log(stringify(inputMap));
console.log("=== INPUT JSON DATA/end ===");


console.log("=== OUTPUT JSON DATA/begin ===");
//console.log(stringify(outputMap));
console.log("(omitted)");
//console.log(stringify(targetPatientList));
//console.log(stringify(targetProcedureRequests));
//console.log(stringify(targetGoals));
//console.log(stringify(targetConditions));
//console.log(stringify(targetMedicationOrders));
//console.log(stringify(targetCarePlans));
console.log("=== OUTPUT JSON DATA/end ===");

//console.log("### OLD TO NEW MAP ###");
//Object.keys(oldToNewIdMap).forEach(
//    function(key)
//    {
//        var value = oldToNewIdMap[key];
//        console.log(">>> " + key + " => " + value);
//    });
return outputMap;
}

FhirCloner.prototype.readData = function(fileName) {
  process.stdout.write('READING JSON FILE: ' + fileName);
  //var modelData = require( path.join(__dirname, 'data/' + fileName) );
  var cwd = process.cwd();
  console.log("");
  console.log("cwd: " + cwd);
  var modelData = require( path.join(cwd, fileName) );
  console.log(', length: ' + modelData.length);
  for (var i = 0; i < modelData.length; i++) {
    var modelName = modelData[i].resourceType;

    queue.push({name: modelName, data: modelData[i]});
    inputMap[modelName] = modelData;
  }
}

// borrowed this function from
//   http://stackoverflow.com/questions/8240637/convert-numbers-to-letters-beyond-the-26-character-alphabet
// renamed function from "colName" to "calculateLetterSequence"
 function calculateLetterSequence(n) {
    var ordA = 'a'.charCodeAt(0);
    var ordZ = 'z'.charCodeAt(0);
    var len = ordZ - ordA + 1;

    var s = "";
    while(n >= 0) {
        s = String.fromCharCode(n % len + ordA) + s;
        n = Math.floor(n / len) - 1;
    }
    return s;
}

FhirCloner.prototype.pullDataFromFhir = function(patientUrlString, inputMap, currentRecursion, oldToNewIdMap, outputPatientId)
{
    // ------ BEGIN ------ //
    console.log("%%%%%");
    console.log("processing URL: " + patientUrlString);
    console.log("%%%%%");

    var patientUrl = url.parse(patientUrlString);

//    var requestOptions = JSON.parse(JSON.stringify(patientUrl));
//    requestOptions.headers = {Accepts: "application/json+fhir" };

    var request = {
            url: patientUrl,
            method: "GET",
            headers: { "Accepts": "application/json+fhir" }
    };
    console.log("about to sent request...");

    HTTP.read(patientUrlString).then(function (response) {
        console.log("inside response BEGIN...");
        var json = JSON.parse(response);
        var jsonString = JSON.stringify(json);
//        console.log("=== SERVER RESPONSE ===");
//        console.log(jsonString);
//        console.log("=== ===");

        var responseEntryList = json.entry;
        responseEntryList.forEach(function (e) {
            var entryType = e.resource.resourceType;
            inputMap[entryType].push(e.resource);
        } );

        //processLoadedData(inputMap);

//        console.log("checking for next link...");

        var linkList = json.link;

//        console.log("linkList: ");
//        console.log(linkList);

        var linkObject = linkList.map(function(i) { return [i.relation, i]; }).reduce(function(result, item) { var key = item[0]; result[key] = item[1].url; return result;}, {});

//        console.log("linkObject:");
//        console.log(linkObject);

        var nextLink = null;
        if (linkObject.hasOwnProperty("next"))
        {
            nextLink = linkObject.next;
        } else
        {
            console.log("#@#@#@#@#@#@ THIS SHOULD BE THE LAST STATEMENT (in reading data from server) ... @#@#@#@#@#@#");
            printSummaryOfLoadedData(inputMap);
            var outputMap = this.processLoadedData(inputMap, oldToNewIdMap, outputPatientId);
            
            this.saveAllToServer(outputMap);


        }
        console.log("next link: " + nextLink);
        console.log("");
        console.log("");
        console.log("");


        console.log("making recursive call to get next page of fhir data...");
        if (currentRecursion < maxRecursion && nextLink !== null)
        {
            pullDataFromFhir(nextLink, inputMap, currentRecursion + 1, oldToNewIdMap, outputPatientId);
        }
        console.log("DONE making recursive call to get next page of fhir data.");


        console.log("inside response END.");
        return json;
    //}).catch(function (err) {
    //    console.log ("ERROR: " + err);
    }).done();


    console.log("after sending request");
    return;
    // ------ END ------ //
}

function stringify(s)
{
  return JSON.stringify(s, null, 2)
};

FhirCloner.prototype.printSummaryOfLoadedData = function(inputMap)
{
    var keys = Object.keys(inputMap);

    console.log("=== summary count of all assembled objects ===");
    for (var i=0; i < keys.length; i++)
    {
        var currentKey = keys[i];
        var entryList = inputMap[currentKey];
        console.log("number of " + currentKey  + ": " + entryList.length);
    }
}
FhirCloner.prototype.saveObjectToServer = function(objectType, o)
{
    //console.log(">>>>> saveObjectToServer on object type " + objectType + "; BEGIN");
    //console.log("===DEBUG/begin===");
    //console.log(JSON.stringify(o));
    //console.log("===DEBUG/end===");
    o = JSON.parse(JSON.stringify(o)); // clone the input object because we have to manipulate it (we don't want to change the original)
    //console.log("!!!!!writing data to server...");
    var objectId = o.id;

//    // TODO: REMOVE THIS STUB CODE WHEN WE ARE USING THE 'REAL' OUTPUT PATIENT
//    // we need this to change the patient ID before PUTing it
//    patientId += new Date().getTime();

    delete o.id; // we cannot have an ID in the PUT body object...
    var basePatientUrlString = baseUrlString + objectType + "/" + objectId;
    //var basePatientUrlString = baseUrlString + 'Patient' + "/" + patientId + "/$validate";
    var basePatientUrl = url.parse(basePatientUrlString);

    // inputMap.Patient = [];
    // inputMap.CarePlan = [];
    // inputMap.Condition = [];
    // inputMap.Goal = [];
    // inputMap.MedicationOrder = [];
    // inputMap.ProcedureRequest = [];

    var objectRequest = JSON.parse(JSON.stringify(basePatientUrl));
    //patientRequest.query =
    //    {
    //        "_format": "json"
    //    };
    //var patientUrlString = url.format(patientUrl);

    objectRequest.method = "PUT";
    //patientRequest.method = "POST";
    objectRequest.headers = {
        "Accepts": "application/json+fhir",
        "Content-Type": "application/json+fhir"
     };
    var objectDataString = stringify(o);
    //patientRequest.body = patientDataString;
    objectRequest.body = [objectDataString];
    //patientRequest.body = ["abc"];

    //var mainPullPromise = pullDataFromFhir(patientUrlString, inputMap, 0);

    //console.log("mainPullPromise: " + mainPullPromise);

    ////
    ////

    //console.log("about to sent request...");
    //console.log("objectRequest (for PUTing to fhir):");
    //console.log(stringify(objectRequest));

    console.log('PUT ' + basePatientUrlString);
    var resource = objectType + '/' + objectId;
    return HTTP.request(objectRequest).then(function (response) {
        var code = response.status;
        if (code === 200 || code === 201) {
            console.log('  SUCCESS ' + code + ' for ' + resource);
        } else {
            console.log('  FAILED ' + code + ' for ' + resource);
        }
    }, function(err) {
        console.log('  ERROR for ' + resource + ':' + err.message);
    });
}

FhirCloner.prototype.saveAllToServer = function(outputMap)
{
    var processingBlocks = { "beginning": [], "middle": [], "end": [] };

    inputOutputMapKeysWithPatient.forEach(function(k) {
        var block = "middle";
        switch(k) {
          case "Patient":
            block = "beginning";
            break;
          case "CarePlan":
            block = "end";
            break;
          default:
            block = "middle";
            break;
        }

        var entriesForCurrentType = outputMap[k];
        entriesForCurrentType.forEach(function(currentObject){
            //saveObjectToServer(k, currentObject);
            processingBlocks[block].push({"objectType": k, "object": currentObject });
            //console.log("##### pushed new (object type) " + k + "; array size now: " + processingBlocks[block].length);
        });

    });

    var beginningBlock = processingBlocks.beginning;
    var middleBlock = processingBlocks.middle;
    var endBlock = processingBlocks.end;
    
    //console.log("beginning block size: " + beginningBlock.length);
    //console.log("middle block size: " + middleBlock.length);
    //console.log("end block size: " + endBlock.length);

    //console.log(">>>");
    //console.log(stringify(beginningBlock[0]));
    //console.log(">>>");

    var invokeSetOfSaveRequests = function(setOfObjects){
        console.log('------------- STARTING NEXT BLOCK --------------');
        var allPromiseArray = setOfObjects.map(function (i) { return saveObjectToServer(i.objectType, i.object); } );
        return Q.all(allPromiseArray);
    };

    //console.log(">>>>> beginningBlock:");
    //console.log(stringify(beginningBlock));
    //console.log(">>>>> end of beginning Block");

    console.log(">>>>> BEFORE starting promises to save data to server");
    invokeSetOfSaveRequests(beginningBlock)
        .thenResolve(middleBlock)
        .then(invokeSetOfSaveRequests)
        .thenResolve(endBlock)
        .then(invokeSetOfSaveRequests)
        .then(function() { console.log(">>>>> AFTER RESOLVING starting promises to save data to server"); });
}

function ClonePatientException(message)
{
    this.message = message;
}

FhirCloner.prototype.parseParameters = function(argv)
{
    var response = {};
    
    console.log("argv: " + stringify(argv));
    
    var inputPatientId = null;
    if (argv.length < 3 || argv.length > 4)
    {
        var message = "must specify one or two arguments -- input_patient_id [output_patient_id] ";
        var e = new ClonePatientException(message);
        console.log(message);
        throw e;
    }

    response.inputPatientId = process.argv[2];
    console.log("[command line parameter] source patient id (to be cloned): " + response.inputPatientId);

    response.outputPatientId = process.argv[3];
    console.log("[command line parameter] output patient id (new patient): " + response.outputPatientId);

    return response;
}