var tv4 = require("tv4");

var utilities = require("./utilities.js");
        
module.exports.logger = console.log;

function log(message)
{
	if(module.exports.logger !== null)
	{
		module.exports.logger(message);
	}
}

function logError(message)
{
	log("ERROR: " + message);
}

function logUsage()
{
	log("USAGE: \"node validateJSON.js <path-to-json-file> <path-to-schema-file> [<path-to-schema-folder>]\"");
}

function exit(exitCode)
{
	process.exit(exitCode);
}

function getCommandLineArgument(commandLineArgumentIndex, errorMessage)
{
	var commandLineArgument = process.argv[commandLineArgumentIndex];
	if(!commandLineArgument && errorMessage)
	{
		logError(errorMessage);
		logUsage();
		exit(-1);
	}
	else
	{
		return commandLineArgument;
	}
}

function getFileContents(filePath)
{
	var fs = require("fs");
	try
	{
		return fs.readFileSync(filePath, "utf8");
	}
	catch(error)
	{
		if(error.code === "ENOENT")
		{
			logError("Could not find file: \"" + error.path + "\"");
		}
		else
		{
			logError("Unrecognized error: " + error);
		}
		exit(-1);
	}
}

function getErrorMessage(prefix, value, suffix)
{
	var errorMessage = prefix;
	if(value === undefined)
	{
		errorMessage += "n";
	}
	else if(value === "")
	{
		errorMessage += "n empty";
	}
	
	if(value !== "")
	{
		errorMessage += " " + value;
	}
	errorMessage += " " + suffix;
	
	return errorMessage;
}

/**
 * Validates the provided JSON object against the provided schema.
 * @param {Object} json
 * @param {Object} schema
 * @return {Object}
 */
module.exports.validate = validate;
function validate(json, schema, missingSchemaFolderPath)
{
	if(!json)
	{
		logError(getErrorMessage("Cannot validate a", json, "json object."));
		return { valid: false, errors: [ { message: "Invalid JSON" } ], missingSchemas: [] };
	}
	else if(!schema)
	{
		logError(getErrorMessage("Cannot use a", schema, "schema for validation."));
		return { valid: false, errors: [ { message: "Invalid schema" } ], missingSchemas: [] };
	}
	else
    {
        tv4.addSchema(json);
        tv4.addSchema(schema);
        var missingUris = tv4.getMissingUris();
        //console.log("tv4 has " + missingUris.length + " missing external schemas after adding json and schema.");
        while(missingUris && missingUris.length > 0)
        {
            var missingUri = missingUris.pop();
            //console.log("\tRetrieving missing schema at \"" + missingUri + "\"");
            
            var missingUriWithJsonEnding = missingUri;
            if(missingUriWithJsonEnding.endsWith(".json") == false)
            {
                missingUriWithJsonEnding += ".json";
            }

            //console.log("missingSchemaFolderPath: \"" + missingSchemaFolderPath + "\"");
            if(missingSchemaFolderPath && utilities.pathExists(missingSchemaFolderPath))
            {
                var missingFileWithJsonEnding = missingUriWithJsonEnding.replace("http://schema.management.azure.com/schemas/", missingSchemaFolderPath);
                //console.log("Retrieving " + missingUriWithJsonEnding + " from disk (" + missingFileWithJsonEnding + ")...");
                tv4.addSchema(missingUri, utilities.readJSONFile(missingFileWithJsonEnding));
            }
            else
            {
                //console.log("Retrieving " + missingUriWithJsonEnding + " from network...");
                tv4.addSchema(missingUri, utilities.readJSONUri(missingUriWithJsonEnding));
            }
            
            missingUris = tv4.getMissingUris();
            //console.log("tv4 has " + missingUris.length + " missing external schemas after adding missing schemas");
        }
        
        var validationResult = tv4.validateMultiple(json, schema);
		var result = { valid: validationResult.valid, errors: [], missingSchemas: validationResult.missing };
		
		for(var errorIndex in validationResult.errors)
		{
			var currentError = validationResult.errors[errorIndex];
            var resultError =
            {
				message: currentError.message,
                dataPath: currentError.dataPath,
				schemaPath: currentError.schemaPath,
			};
            if(!resultError.dataPath)
            {
                resultError.dataPath = "/";
            }
            
			result.errors.push(resultError);
		}
		
		return result;
	}
}

module.exports.validateFile = validateFile;
function validateFile(jsonFilePath, schemaFilePath, missingSchemaFolderPath)
{
	var json = utilities.readJSONFile(jsonFilePath);
	var schemaJson = utilities.readJSONFile(schemaFilePath);
	
	return validate(json, schemaJson, missingSchemaFolderPath);
}

if(require.main === module)
{
	// commandLineArguments[0] is node.exe
	// commandLineArguments[1] is validateResourceSchema.js
	var jsonFilePath = getCommandLineArgument(2, "The first argument must be the path to the json file to validate.");
	var schemaFilePath = getCommandLineArgument(3, "The second argument must be the path to the schema file to use for validation.");
    var missingSchemaFolderPath = getCommandLineArgument(4);
	
	var validationResult = validateFile(jsonFilePath, schemaFilePath, missingSchemaFolderPath);
	if(validationResult && validationResult.valid)
	{
		log("JSON validation passed");
	}
	else
	{
		log("JSON validation failed");
		for(var errorIndex in validationResult.errors)
		{
			if(errorIndex > 0)
			{
				log();
			}
			
			log("Error " + errorIndex + ":");
			log("\tMessage: \"" + validationResult.errors[errorIndex].message + "\"");
			log("\tSchema Path: " + validationResult.errors[errorIndex].schemaPath);
		}
	}
}