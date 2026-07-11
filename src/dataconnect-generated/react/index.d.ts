import { CreateUserAccountData, CreateUserAccountVariables, CreateNewMemoryData, CreateNewMemoryVariables, GetUserDocumentsData, CreateLegacyMessageData, CreateLegacyMessageVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUserAccount(options?: useDataConnectMutationOptions<CreateUserAccountData, FirebaseError, CreateUserAccountVariables>): UseDataConnectMutationResult<CreateUserAccountData, CreateUserAccountVariables>;
export function useCreateUserAccount(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserAccountData, FirebaseError, CreateUserAccountVariables>): UseDataConnectMutationResult<CreateUserAccountData, CreateUserAccountVariables>;

export function useCreateNewMemory(options?: useDataConnectMutationOptions<CreateNewMemoryData, FirebaseError, CreateNewMemoryVariables>): UseDataConnectMutationResult<CreateNewMemoryData, CreateNewMemoryVariables>;
export function useCreateNewMemory(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewMemoryData, FirebaseError, CreateNewMemoryVariables>): UseDataConnectMutationResult<CreateNewMemoryData, CreateNewMemoryVariables>;

export function useGetUserDocuments(options?: useDataConnectQueryOptions<GetUserDocumentsData>): UseDataConnectQueryResult<GetUserDocumentsData, undefined>;
export function useGetUserDocuments(dc: DataConnect, options?: useDataConnectQueryOptions<GetUserDocumentsData>): UseDataConnectQueryResult<GetUserDocumentsData, undefined>;

export function useCreateLegacyMessage(options?: useDataConnectMutationOptions<CreateLegacyMessageData, FirebaseError, CreateLegacyMessageVariables>): UseDataConnectMutationResult<CreateLegacyMessageData, CreateLegacyMessageVariables>;
export function useCreateLegacyMessage(dc: DataConnect, options?: useDataConnectMutationOptions<CreateLegacyMessageData, FirebaseError, CreateLegacyMessageVariables>): UseDataConnectMutationResult<CreateLegacyMessageData, CreateLegacyMessageVariables>;
