import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { authHeaders } from './http'
import type { AppConfig, Comment, Issue, Preferences, User } from './types'

export const service = createApi({
  reducerPath: 'service',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      for (const [name, value] of Object.entries(authHeaders())) headers.set(name, value)
      return headers
    },
  }),
  tagTypes: ['Issue', 'Comments', 'Preferences'],
  endpoints: (build) => ({
    getConfig: build.query<AppConfig, void>({ query: () => '/config' }),
    getUsers: build.query<User[], void>({ query: () => '/users' }),
    getIssue: build.query<Issue, string>({
      query: (key) => `/issues/${key}`,
      providesTags: (_result, _error, key) => [{ type: 'Issue', id: key }],
    }),
    updateIssue: build.mutation<Issue, { key: string; changes: Partial<Issue> }>({
      query: ({ key, changes }) => ({ url: `/issues/${key}`, method: 'PATCH', body: changes }),
      invalidatesTags: (_result, _error, { key }) => [{ type: 'Issue', id: key }],
    }),
    getComments: build.query<Comment[], string>({
      query: (key) => `/issues/${key}/comments`,
      providesTags: (_result, _error, key) => [{ type: 'Comments', id: key }],
    }),
    addComment: build.mutation<Comment, { key: string; body: string }>({
      query: ({ key, body }) => ({
        url: `/issues/${key}/comments`,
        method: 'POST',
        body: { body },
      }),
      invalidatesTags: (_result, _error, { key }) => [
        { type: 'Comments', id: key },
        { type: 'Issue', id: key },
      ],
    }),
    editComment: build.mutation<Comment, { id: string; issueKey: string; body: string }>({
      query: ({ id, body }) => ({ url: `/comments/${id}`, method: 'PATCH', body: { body } }),
      invalidatesTags: (_result, _error, { issueKey }) => [{ type: 'Comments', id: issueKey }],
    }),
    getPreferences: build.query<Preferences, void>({
      query: () => '/preferences',
      providesTags: ['Preferences'],
    }),
    updatePreferences: build.mutation<Preferences, Preferences>({
      query: (body) => ({ url: '/preferences', method: 'PUT', body }),
      invalidatesTags: ['Preferences'],
    }),
  }),
})

export const {
  useAddCommentMutation,
  useEditCommentMutation,
  useGetCommentsQuery,
  useGetConfigQuery,
  useGetIssueQuery,
  useGetPreferencesQuery,
  useGetUsersQuery,
  useUpdateIssueMutation,
  useUpdatePreferencesMutation,
} = service
