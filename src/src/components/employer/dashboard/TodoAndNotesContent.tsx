'use client'

import { useState, useEffect } from 'react'
import type { EmployerTodo, TodoPriority, JobSessionNote, JobSessionNoteType, JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils/dateFormatters'
import { Plus, CheckCircle, Circle, AlertTriangle, Calendar, Trash2, Edit2, MessageSquare, Briefcase } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { format, isPast, parseISO } from 'date-fns'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer: Customer | null }
}

interface JobSessionNoteWithSession extends JobSessionNote {
  job_session: JobSessionWithDetails
}

type ContentTab = 'todos' | 'notes'

interface TodoAndNotesContentProps {
  employerId: string
}

export function TodoAndNotesContent({ employerId }: TodoAndNotesContentProps) {
  const [todos, setTodos] = useState<EmployerTodo[]>([])
  const [jobNotes, setJobNotes] = useState<JobSessionNoteWithSession[]>([])
  const [completedSessions, setCompletedSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentTab>('todos')
  const [showTodoDialog, setShowTodoDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [editingTodo, setEditingTodo] = useState<EmployerTodo | null>(null)
  const [selectedSession, setSelectedSession] = useState<JobSessionWithDetails | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [todoTitle, setTodoTitle] = useState('')
  const [todoDescription, setTodoDescription] = useState('')
  const [todoDueDate, setTodoDueDate] = useState('')
  const [todoPriority, setTodoPriority] = useState<TodoPriority>('MEDIUM')

  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<JobSessionNoteType>('CLIENT_FEEDBACK')

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: todosData, error: todosError } = await supabase
        .from('employer_todos')
        .select('*')
        .eq('employer_id', employerId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (todosError) throw todosError
      setTodos(todosData || [])

      const { data: notesData, error: notesError } = await supabase
        .from('job_session_notes')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(*, customer:customers(*))
          )
        `)
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false })

      if (notesError) throw notesError
      setJobNotes((notesData || []) as JobSessionNoteWithSession[])

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*, customer:customers(*))
        `)
        .in('status', ['COMPLETED', 'EVALUATED'])
        .order('completed_at', { ascending: false })
        .limit(50)

      if (sessionsError) throw sessionsError
      setCompletedSessions((sessionsData || []) as JobSessionWithDetails[])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetTodoForm = () => {
    setTodoTitle('')
    setTodoDescription('')
    setTodoDueDate('')
    setTodoPriority('MEDIUM')
    setEditingTodo(null)
  }

  const handleOpenAddTodo = () => {
    resetTodoForm()
    setShowTodoDialog(true)
  }

  const handleOpenEditTodo = (todo: EmployerTodo) => {
    setEditingTodo(todo)
    setTodoTitle(todo.title)
    setTodoDescription(todo.description || '')
    setTodoDueDate(todo.due_date || '')
    setTodoPriority(todo.priority)
    setShowTodoDialog(true)
  }

  const handleSaveTodo = async () => {
    if (!todoTitle.trim()) return

    setActionLoading(true)
    try {
      if (editingTodo) {
        const { error } = await supabase
          .from('employer_todos')
          .update({
            title: todoTitle.trim(),
            description: todoDescription.trim() || null,
            due_date: todoDueDate || null,
            priority: todoPriority,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTodo.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('employer_todos')
          .insert({
            employer_id: employerId,
            title: todoTitle.trim(),
            description: todoDescription.trim() || null,
            due_date: todoDueDate || null,
            priority: todoPriority
          })

        if (error) throw error
      }

      setShowTodoDialog(false)
      resetTodoForm()
      await loadData()
    } catch (error) {
      console.error('Error saving todo:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleTodo = async (todo: EmployerTodo) => {
    try {
      const { error } = await supabase
        .from('employer_todos')
        .update({
          is_completed: !todo.is_completed,
          completed_at: !todo.is_completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', todo.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error toggling todo:', error)
    }
  }

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('Delete this to-do?')) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('employer_todos')
        .delete()
        .eq('id', todoId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting todo:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const resetNoteForm = () => {
    setNoteContent('')
    setNoteType('CLIENT_FEEDBACK')
    setSelectedSession(null)
  }

  const handleOpenAddNote = (session: JobSessionWithDetails) => {
    setSelectedSession(session)
    resetNoteForm()
    setShowNoteDialog(true)
  }

  const handleSaveNote = async () => {
    if (!selectedSession || !noteContent.trim()) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('job_session_notes')
        .insert({
          job_session_id: selectedSession.id,
          employer_id: employerId,
          note_type: noteType,
          content: noteContent.trim()
        })

      if (error) throw error

      setShowNoteDialog(false)
      resetNoteForm()
      await loadData()
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('job_session_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting note:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getPriorityBadge = (priority: TodoPriority) => {
    switch (priority) {
      case 'HIGH':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">High</Badge>
      case 'MEDIUM':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Medium</Badge>
      case 'LOW':
        return <Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/30">Low</Badge>
    }
  }

  const getNoteTypeBadge = (type: JobSessionNoteType) => {
    switch (type) {
      case 'CLIENT_FEEDBACK':
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">Client Feedback</Badge>
      case 'INTERNAL':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">Internal</Badge>
      case 'FOLLOW_UP':
        return <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">Follow Up</Badge>
    }
  }

  const sortedTodos = [...todos].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1
    }
    if (!a.is_completed) {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    return 0
  })

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('todos')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'todos'
              ? 'bg-amber-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
          }`}
        >
          My To-Do
          {todos.filter(t => !t.is_completed).length > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'todos' ? 'bg-white/20' : 'bg-white/10'
            }`}>
              {todos.filter(t => !t.is_completed).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'bg-amber-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
          }`}
        >
          Client Notes
        </button>
      </div>

      {/* To-Do Content */}
      {activeTab === 'todos' && (
        <div className="space-y-3">
          <Button
            onClick={handleOpenAddTodo}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add To-Do
          </Button>

          {sortedTodos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No to-do items
            </div>
          ) : (
            sortedTodos.map((todo) => {
              const isOverdue = todo.due_date && !todo.is_completed && isPast(parseISO(todo.due_date + 'T23:59:59'))

              return (
                <div
                  key={todo.id}
                  className={`rounded-xl p-4 border ${
                    todo.is_completed
                      ? 'bg-white/5 border-white/10 opacity-60'
                      : isOverdue
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTodo(todo)}
                      className="mt-0.5"
                    >
                      {todo.is_completed ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium ${
                          todo.is_completed ? 'text-gray-500 line-through' : 'text-white'
                        }`}>
                          {todo.title}
                        </h4>
                        {getPriorityBadge(todo.priority)}
                      </div>

                      {todo.description && (
                        <p className="text-sm text-gray-400 mt-1">
                          {todo.description}
                        </p>
                      )}

                      {todo.due_date && (
                        <div className={`flex items-center gap-1 text-sm mt-2 ${
                          isOverdue ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          <Calendar className="w-3 h-3" />
                          <span>Due {formatDate(todo.due_date)}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditTodo(todo)}
                          className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTodo(todo.id)}
                          disabled={actionLoading}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Client Notes Content */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {/* Recent completed jobs to add notes to */}
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <h4 className="font-medium text-amber-400 mb-2 text-sm">
              Recent Completed Jobs
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {completedSessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleOpenAddNote(session)}
                  className="w-full flex items-center justify-between p-2 bg-white/5 rounded-lg border border-amber-500/10 hover:border-amber-500/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-white">
                      {session.job_template?.job_code}
                    </span>
                    <span className="text-xs text-gray-500">
                      {session.job_template?.customer?.full_name}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 text-amber-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Existing notes */}
          {jobNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No client notes yet
            </div>
          ) : (
            jobNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-white">
                      {note.job_session?.job_template?.job_code}
                    </span>
                  </div>
                  {getNoteTypeBadge(note.note_type)}
                </div>

                {note.job_session?.job_template?.customer && (
                  <p className="text-sm text-gray-500 mb-2">
                    {note.job_session.job_template.customer.full_name}
                  </p>
                )}

                <p className="text-gray-300">{note.content}</p>

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {formatDate(note.created_at)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={actionLoading}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Todo Dialog */}
      <Dialog open={showTodoDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTodoDialog(false)
          resetTodoForm()
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTodo ? 'Edit To-Do' : 'Add To-Do'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Title
              </label>
              <Input
                placeholder="What needs to be done?"
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Description (optional)
              </label>
              <Textarea
                placeholder="Additional details..."
                value={todoDescription}
                onChange={(e) => setTodoDescription(e.target.value)}
                rows={2}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={todoDueDate}
                  onChange={(e) => setTodoDueDate(e.target.value)}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  Priority
                </label>
                <Select value={todoPriority} onValueChange={(v) => setTodoPriority(v as TodoPriority)}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    <SelectItem value="LOW" className="text-white hover:bg-white/10">Low</SelectItem>
                    <SelectItem value="MEDIUM" className="text-white hover:bg-white/10">Medium</SelectItem>
                    <SelectItem value="HIGH" className="text-white hover:bg-white/10">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTodoDialog(false)
                resetTodoForm()
              }}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTodo}
              disabled={!todoTitle.trim() || actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {editingTodo ? 'Save Changes' : 'Add To-Do'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowNoteDialog(false)
          resetNoteForm()
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">
              Add Note for {selectedSession?.job_template?.job_code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedSession?.job_template?.customer && (
              <div className="bg-white/5 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Customer: </span>
                <span className="font-medium text-white">
                  {selectedSession.job_template.customer.full_name}
                </span>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Note Type
              </label>
              <Select value={noteType} onValueChange={(v) => setNoteType(v as JobSessionNoteType)}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  <SelectItem value="CLIENT_FEEDBACK" className="text-white hover:bg-white/10">Client Feedback</SelectItem>
                  <SelectItem value="INTERNAL" className="text-white hover:bg-white/10">Internal Note</SelectItem>
                  <SelectItem value="FOLLOW_UP" className="text-white hover:bg-white/10">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Note
              </label>
              <Textarea
                placeholder="Enter your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNoteDialog(false)
                resetNoteForm()
              }}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={!noteContent.trim() || actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
