import { TemplateRoot } from "./src/parser/parser";

const template = TemplateRoot.create('./resources/example.yml');
console.log(JSON.stringify(template.contents, null, 2))