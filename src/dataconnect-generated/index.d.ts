import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateLegacyMessageData {
  legacyMessage_insert: LegacyMessage_Key;
}

export interface CreateLegacyMessageVariables {
  content: string;
  recipientEmail: string;
}

export interface CreateNewMemoryData {
  memory_insert: Memory_Key;
}

export interface CreateNewMemoryVariables {
  type: string;
  title?: string | null;
  description?: string | null;
}

export interface CreateUserAccountData {
  user_insert: User_Key;
}

export interface CreateUserAccountVariables {
  email: string;
  fullName: string;
}

export interface Document_Key {
  id: UUIDString;
  __typename?: 'Document_Key';
}

export interface FamilyMember_Key {
  id: UUIDString;
  __typename?: 'FamilyMember_Key';
}

export interface GetUserDocumentsData {
  documents: ({
    title: string;
    fileUrl: string;
    category?: string | null;
  })[];
}

export interface LegacyMessage_Key {
  id: UUIDString;
  __typename?: 'LegacyMessage_Key';
}

export interface Memory_Key {
  id: UUIDString;
  __typename?: 'Memory_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserAccountRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserAccountVariables): MutationRef<CreateUserAccountData, CreateUserAccountVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserAccountVariables): MutationRef<CreateUserAccountData, CreateUserAccountVariables>;
  operationName: string;
}
export const createUserAccountRef: CreateUserAccountRef;

export function createUserAccount(vars: CreateUserAccountVariables): MutationPromise<CreateUserAccountData, CreateUserAccountVariables>;
export function createUserAccount(dc: DataConnect, vars: CreateUserAccountVariables): MutationPromise<CreateUserAccountData, CreateUserAccountVariables>;

interface CreateNewMemoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewMemoryVariables): MutationRef<CreateNewMemoryData, CreateNewMemoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNewMemoryVariables): MutationRef<CreateNewMemoryData, CreateNewMemoryVariables>;
  operationName: string;
}
export const createNewMemoryRef: CreateNewMemoryRef;

export function createNewMemory(vars: CreateNewMemoryVariables): MutationPromise<CreateNewMemoryData, CreateNewMemoryVariables>;
export function createNewMemory(dc: DataConnect, vars: CreateNewMemoryVariables): MutationPromise<CreateNewMemoryData, CreateNewMemoryVariables>;

interface GetUserDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserDocumentsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserDocumentsData, undefined>;
  operationName: string;
}
export const getUserDocumentsRef: GetUserDocumentsRef;

export function getUserDocuments(options?: ExecuteQueryOptions): QueryPromise<GetUserDocumentsData, undefined>;
export function getUserDocuments(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserDocumentsData, undefined>;

interface CreateLegacyMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateLegacyMessageVariables): MutationRef<CreateLegacyMessageData, CreateLegacyMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateLegacyMessageVariables): MutationRef<CreateLegacyMessageData, CreateLegacyMessageVariables>;
  operationName: string;
}
export const createLegacyMessageRef: CreateLegacyMessageRef;

export function createLegacyMessage(vars: CreateLegacyMessageVariables): MutationPromise<CreateLegacyMessageData, CreateLegacyMessageVariables>;
export function createLegacyMessage(dc: DataConnect, vars: CreateLegacyMessageVariables): MutationPromise<CreateLegacyMessageData, CreateLegacyMessageVariables>;

