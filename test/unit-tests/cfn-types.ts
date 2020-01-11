
export interface ICfnRefValue { Ref: string; }
export interface ICfnGetAttValue  { 'Fn::GetAtt': string[]; }
export interface ICfnJoinValue  { 'Fn::Join': ICfnValue[]; }
export type ICfnValue = string | ICfnRefValue  | ICfnGetAttValue | ICfnJoinValue;
export type ICfnParameterType = 'String' | 'Number' | 'List<Number>' | 'CommaDelimitedList' | string;

export interface ICfnParameterWithExport {
    ExportAccountId: string;
    ExportRegion: string;
    ExportName: string;
}

export interface ICfnParameter {
    Type: ICfnParameterType;
    Default: string;
    Description: string;
}

export interface ICfnOutput {
    Description: string;
    Condition: string;
    Value: ICfnValue;
    Export: { Name: ICfnValue; };
}

export interface ICfnResource {
    Type: string;
    Condition: string;
    DependsOn: string;
    Properties: Record<string, any>;
}

export interface ICfnTemplate {
    Parameters: Record<string, ICfnParameter & ICfnParameterWithExport>;
    Resources: Record<string, ICfnResource>;
    Outputs: Record<string, ICfnOutput>;
}
