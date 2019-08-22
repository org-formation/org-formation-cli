"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const md5 = require("md5");
const Path = __importStar(require("path"));
const cloudformation_resource_1 = require("./cloudformation-resource");
class CloudFormationStackResource extends cloudformation_resource_1.CloudFormationResource {
    constructor(root, id, resource) {
        super(root, id, resource);
        this.templateUnresolvable = false;
        this.props = resource.Properties;
        this.templateUrl = this.props.TemplateURL;
        if (!Path.isAbsolute(this.templateUrl)) {
            this.templateUrl = Path.resolve(root.dirname, this.templateUrl);
        }
        try {
            this.templateContents = fs_1.readFileSync(this.templateUrl).toString('utf-8');
            this.templateHash = md5(this.templateContents);
        }
        catch (err) {
            if (err && err.code === 'ENOENT') {
                this.templateUnresolvable = true;
                this.templateHash = 'unresolvable';
            }
            else {
                throw err;
            }
        }
    }
    calculateHash() {
        return this.resourceHash + '/' + this.templateHash;
    }
}
exports.CloudFormationStackResource = CloudFormationStackResource;
//# sourceMappingURL=cloudformation-stack-resource.js.map