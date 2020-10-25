/**
 * Parser and schema for CloudFormation YAML template tags.
 *
 * There are some existing modules out there:
 *    https://github.com/yyolk/cloudformation-js-yaml-schema
 *    https://github.com/KoharaKazuya/js-yaml-schema-cfn
 * But both are poorly documented, with insufficient tests, and don't fully work.
 *
 * This implementation is based on the official AWS python client:
 * https://github.com/aws/aws-cli/blob/develop/awscli/customizations/cloudformation/yamlhelper.py
 *
 * Modified by OC to support other custom tags needed by org-formation.
 */
"use strict";

const jsYaml = require('js-yaml');

/**
 * Split a string on the given separator just once, returning an array of two parts, or null.
 */
function splitOne(str, sep) {
  let index = str.indexOf(sep);
  return index < 0 ? null : [str.slice(0, index), str.slice(index + sep.length)];
}

/**
 * Returns true if obj is a representation of a CloudFormation intrinsic, i.e. an object with a
 * single property at key keyName.
 */
function checkType(obj, keyName) {
  return obj && typeof obj === 'object' && Object.keys(obj).length === 1 &&
    obj.hasOwnProperty(keyName);
}


const overrides = {
  // ShortHand notation for !GetAtt accepts Resource.Attribute format while the standard notation
  // is to use an array [Resource, Attribute]. Convert shorthand to standard format.
  GetAtt: {
    parse: data => typeof data === 'string' ? splitOne(data, '.') : data,
    dump: data => data.join('.')
  }
};

function applyOverrides(data, tag, method) {
  return overrides[tag] ? overrides[tag][method](data) : data;
}

/**
 * Generic tag-creating helper. For the given name of the form 'Fn::Something' (or just
 * 'Something'), creates a js-yaml Type object that can parse and dump this type. It creates it
 * for all types of values, for simplicity and because that's how the official Python version
 * works.
 */
function makeTagTypes(name) {
  const parts = splitOne(name, '::');
  const tag = parts ? parts[1] : name;
  // Translate in the same way for all types, to match Python's generic translation.
  return ['scalar', 'sequence', 'mapping'].map(kind => new jsYaml.Type('!' + tag, {
    kind: kind,
    construct: data => ({[name]: applyOverrides(data, tag, 'parse')}),
    predicate: obj => checkType(obj, name),
    represent: obj => applyOverrides(obj[name], tag, 'dump'),
  }));
}

/**
 * This list is from
 * http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html
 * Note that the Python version handles ANY tag that starts with ! in the same way (translating it
 * to Fn:: prefix, but js-yaml requires listing tags explicitly.
 */
const supportedFunctions = [
  'Fn::Base64',
  'Fn::Cidr',
  'Fn::FindInMap',
  'Fn::GetAtt',
  'Fn::GetAZs',
  'Fn::ImportValue',
  'Fn::Join',
  'Fn::Select',
  'Fn::Split',
  'Fn::Sub',
  'Fn::Transform',
  'Ref',
  'Condition',
  'Fn::And',
  'Fn::Equals',
  'Fn::If',
  'Fn::Not',
  'Fn::Or',
  'Fn::CopyValue',
  'Fn::ReadFile',
  'Fn::MD5',
  'Fn::MD5Dir',
  'Fn::MD5File',
  'Fn::JsonString',
  'Fn::Include'
];

let allTagTypes = [];
for (let name of supportedFunctions) {
  allTagTypes.push(...makeTagTypes(name));
}

/**
 * The actual js-yaml schema, extending the DEFAULT_SAFE_SCHEMA.
 */
const schema = new jsYaml.Schema({
  include: [ jsYaml.CORE_SCHEMA ],
  implicit: [],
  explicit: allTagTypes,
});
exports.schema = schema;



const tagTypes = exports.schema.explicit;
tagTypes.push(...makeTagTypes('Fn::CopyValue'));
exports.schema = new jsYaml.Schema({
  include: [ jsYaml.CORE_SCHEMA ],
  implicit: [],
  explicit: allTagTypes,
});

/**
 * Convenience function to parse the given yaml input.
 */
function yamlParse(input) {
  return jsYaml.safeLoad(input, { schema: schema });
}
exports.yamlParse = yamlParse;


/**
 * Convenience function to serialize the given object to Yaml.
 */
function yamlDump(input) {
  return jsYaml.safeDump(input, { schema: schema });
}
exports.yamlDump = yamlDump;
