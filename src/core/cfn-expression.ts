
export interface ICfnCopyValue { 'Fn::CopyValue': string[] }
export interface ICfnRefExpression { Ref: string }
export interface ICfnGetAttExpression  { 'Fn::GetAtt': string[] }
export interface ICfnJoinExpression  { 'Fn::Join': ICfnExpression[] }
export interface ICfnSubExpression  { 'Fn::Sub': any }
export type ICfnExpression = string | ICfnRefExpression  | ICfnGetAttExpression | ICfnJoinExpression | ICfnSubExpression | ICfnCopyValue;
