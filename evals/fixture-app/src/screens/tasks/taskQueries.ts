import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'

export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
}

export function useTasks() {
  return useQuery({ queryKey: taskKeys.list(), queryFn: api.listTasks })
}

export function useAddTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.addTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', 'list'] }),
  })
}
