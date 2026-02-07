'use client'

import { useState, useEffect } from 'react'
import type { Employee, EmployerNote, EmployerNoteType } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils/dateFormatters'
import { Plus, User, FileText, AlertCircle, Calendar, Clock, Trash2, Edit2 } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { format } from 'date-fns'

interface EmployerNoteWithEmployee extends EmployerNote {
  employee: Employee
}

type NoteFilter = 'ALL' | EmployerNoteType

interface EmployeeNotesContentProps {
  employerId: string
}

export function EmployeeNotesContent({ employerId }: EmployeeNotesContentProps) {
  const [notes, setNotes] = useState<EmployerNoteWithEmployee[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<NoteFilter>('ALL')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingNote, setEditingNote] = useState<EmployerNoteWithEmployee | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formNoteType, setFormNoteType] = useState<EmployerNoteType>('OTHER')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formNoteDate, setFormNoteDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('full_name')

      if (employeesError) throw employeesError
      setEmployees(employeesData || [])

      const { data: notesData, error: notesError } = await supabase
        .from('employer_notes')
        .select(`
          *,
          employee:employees(*)
        `)
        .eq('employer_id', employerId)
        .order('note_date', { ascending: false })

      if (notesError) throw notesError
      setNotes((notesData || []) as EmployerNoteWithEmployee[])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormEmployeeId('')
    setFormNoteType('OTHER')
    setFormTitle('')
    setFormContent('')
    setFormNoteDate(format(new Date(), 'yyyy-MM-dd'))
    setEditingNote(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setShowAddDialog(true)
  }

  const handleOpenEdit = (note: EmployerNoteWithEmployee) => {
    setEditingNote(note)
    setFormEmployeeId(note.employee_id)
    setFormNoteType(note.note_type)
    setFormTitle(note.title)
    setFormContent(note.content || '')
    setFormNoteDate(note.note_date)
    setShowAddDialog(true)
  }

  const handleSave = async () => {
    if (!formEmployeeId || !formTitle.trim() || !formNoteDate) return

    setActionLoading(true)
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('employer_notes')
          .update({
            employee_id: formEmployeeId,
            note_type: formNoteType,
            title: formTitle.trim(),
            content: formContent.trim() || null,
            note_date: formNoteDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingNote.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('employer_notes')
          .insert({
            employer_id: employerId,
            employee_id: formEmployeeId,
            note_type: formNoteType,
            title: formTitle.trim(),
            content: formContent.trim() || null,
            note_date: formNoteDate
          })

        if (error) throw error
      }

      setShowAddDialog(false)
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('employer_notes')
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

  const filteredNotes = filter === 'ALL'
    ? notes
    : notes.filter(n => n.note_type === filter)

  const getNoteTypeBadge = (type: EmployerNoteType) => {
    switch (type) {
      case 'ILLNESS':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">Illness</Badge>
      case 'ABSENCE':
        return <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">Absence</Badge>
      case 'PERFORMANCE':
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">Performance</Badge>
      case 'OTHER':
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">Other</Badge>
    }
  }

  const noteTypes: { value: EmployerNoteType; label: string }[] = [
    { value: 'ILLNESS', label: 'Illness' },
    { value: 'ABSENCE', label: 'Absence' },
    { value: 'PERFORMANCE', label: 'Performance' },
    { value: 'OTHER', label: 'Other' },
  ]

  const filterOptions: { value: NoteFilter; label: string }[] = [
    { value: 'ALL', label: 'All Notes' },
    ...noteTypes
  ]

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      {/* Header with filter and add button */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as NoteFilter)}>
          <SelectTrigger className="flex-1 bg-white/5 border-white/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-white/20">
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notes found
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white/5 rounded-xl p-4 border border-white/10"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      {note.employee.full_name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {formatDate(note.note_date)}
                    </p>
                  </div>
                </div>
                {getNoteTypeBadge(note.note_type)}
              </div>

              {/* Content */}
              <div className="mb-3">
                <h5 className="font-medium text-white">{note.title}</h5>
                {note.content && (
                  <p className="text-sm text-gray-400 mt-1">{note.content}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenEdit(note)}
                  className="flex-1 bg-white/10 border border-white/30 text-white hover:bg-white/20"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDelete(note.id)}
                  disabled={actionLoading}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false)
          resetForm()
        }
      }}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingNote ? 'Edit Note' : 'Add Employee Note'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Employee
              </label>
              <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id} className="text-white hover:bg-white/10">
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Note Type
              </label>
              <Select value={formNoteType} onValueChange={(v) => setFormNoteType(v as EmployerNoteType)}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  {noteTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-white hover:bg-white/10">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Date
              </label>
              <Input
                type="date"
                value={formNoteDate}
                onChange={(e) => setFormNoteDate(e.target.value)}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Title
              </label>
              <Input
                placeholder="Note title..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Details (optional)
              </label>
              <Textarea
                placeholder="Additional details..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={3}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowAddDialog(false)
                resetForm()
              }}
              className="bg-white/10 border border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formEmployeeId || !formTitle.trim() || !formNoteDate || actionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingNote ? 'Save Changes' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
