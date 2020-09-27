
export interface ICfnCopyValue { 'Fn::CopyValue': string[] }
export interface ICfnRefExpression { Ref: string }
export interface ICfnGetAttExpression  { 'Fn::GetAtt': string[] }
export interface ICfnJoinExpression  { 'Fn::Join': ICfnExpression[] }
export interface ICfnFindInMapExpression  { 'Fn::FindInMap': ICfnExpression[] }
export interface ICfnSubExpression  { 'Fn::Sub': any }
export type ICfnExpression = string | ICfnRefExpression | ICfnFindInMapExpression | ICfnGetAttExpression | ICfnJoinExpression | ICfnSubExpression | ICfnCopyValue;
