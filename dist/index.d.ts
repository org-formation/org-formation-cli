export declare function updateTemplate(templateFile: string, command: ICommandArgs): Promise<void>;
export declare function generateTemplate(filePath: string, command: ICommandArgs): Promise<void>;
interface ICommandArgs {
    profile: string;
}
export {};
