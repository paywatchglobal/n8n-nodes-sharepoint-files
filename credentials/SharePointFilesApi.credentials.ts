import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SharePointFilesApi implements ICredentialType {
	name = 'sharePointFilesApi';

	displayName = 'SharePoint Files API';

	icon = { light: 'file:sharepoint.svg', dark: 'file:sharepoint.svg' } as const;

	documentationUrl =
		'https://learn.microsoft.com/en-us/graph/auth-v2-service';

	properties: INodeProperties[] = [
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			default: '',
			required: true,
			description: 'The Azure AD / Microsoft Entra tenant ID',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'The Application (client) ID from the app registration',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The client secret from the app registration',
		},
	];
}
