
export interface ICfnCopyValue { 'Fn::CopyValue': string[] }
export interface ICfnRefValue { Ref: string }
export interface ICfnGetAttValue  { 'Fn::GetAtt': string[] }
export interface ICfnJoinValue  { 'Fn::Join': ICfnExpression[] }
export interface ICfnSubValue  { 'Fn::Sub': any }
export type ICfnExpression = string | ICfnRefValue  | ICfnGetAttValue | ICfnJoinValue | ICfnSubValue | ICfnCopyValue;
