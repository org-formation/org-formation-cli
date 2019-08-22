"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var OrgResourceTypes;
(function (OrgResourceTypes) {
    OrgResourceTypes["ServiceControlPolicy"] = "OC::ORG::ServiceControlPolicy";
    OrgResourceTypes["OrganizationalUnit"] = "OC::ORG::OrganizationalUnit";
    OrgResourceTypes["Account"] = "OC::ORG::Account";
    OrgResourceTypes["MasterAccount"] = "OC::ORG::MasterAccount";
    OrgResourceTypes["OrganizationRoot"] = "OC::ORG::OrganizationRoot";
})(OrgResourceTypes = exports.OrgResourceTypes || (exports.OrgResourceTypes = {}));
var ResourceTypes;
(function (ResourceTypes) {
    ResourceTypes["StackResource"] = "AWS::CloudFormation::Stack";
    ResourceTypes["Config"] = "OC::ORG::Config";
    ResourceTypes["CloudTrail"] = "OC::ORG::CloudTrail";
    ResourceTypes["SharedTopic"] = "OC::ORG::SharedTopic";
    ResourceTypes["SharedLogGroup"] = "OC::ORG::SharedLogGroup";
    ResourceTypes["SharedBucket"] = "OC::ORG::SharedBucket";
    ResourceTypes["SharedFunction"] = "OC::ORG::SharedFunction";
    ResourceTypes["SharedCustomAuthorizer"] = "OC::ORG::SharedCustomAuthorizer";
    ResourceTypes["SharedSecret"] = "OC::ORG::SharedSecret";
    ResourceTypes["SharedRole"] = "OC::ORG::SharedRole";
    ResourceTypes["SharedRoleWithNotification"] = "OC::ORG::SharedRoleWithNotification";
    ResourceTypes["SharedInternalApiGateway"] = "OC::ORG::SharedInternalApiGateway";
})(ResourceTypes = exports.ResourceTypes || (exports.ResourceTypes = {}));
//# sourceMappingURL=resource-types.js.map