import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Duplicates a job template including all steps, checklist items, and images.
 * The duplicate is always created as DRAFT status.
 *
 * @param supabase - Supabase client instance
 * @param sourceJobId - The ID of the job template to duplicate
 * @returns The new job template ID, or null on error
 */
export async function duplicateJob(
  supabase: SupabaseClient,
  sourceJobId: string
): Promise<string | null> {
  try {
    // 1. Fetch the source template
    const { data: sourceJob, error: fetchError } = await supabase
      .from('job_templates')
      .select('*')
      .eq('id', sourceJobId)
      .single()

    if (fetchError || !sourceJob) {
      console.error('Error fetching source job:', fetchError)
      return null
    }

    // 2. Find the next available template number for this client code
    const { data: existingJobs } = await supabase
      .from('job_templates')
      .select('template_number')
      .eq('client_code', sourceJob.client_code)
      .order('template_number', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (existingJobs && existingJobs.length > 0) {
      const lastNumber = parseInt(existingJobs[0].template_number)
      nextNumber = lastNumber + 1
    }

    const templateNumber = nextNumber.toString().padStart(2, '0')

    // 3. Insert the duplicate template with ALL fields
    const duplicate = {
      client_code: sourceJob.client_code,
      template_number: templateNumber,
      version_letter: 'A',
      title: `${sourceJob.title} (Copy)`,
      description: sourceJob.description,
      address: sourceJob.address,
      duration_minutes: sourceJob.duration_minutes,
      price_per_hour: sourceJob.price_per_hour,
      notes: sourceJob.notes,
      timezone: sourceJob.timezone,
      image_url: sourceJob.image_url,
      // Window-based scheduling
      window_start_day: sourceJob.window_start_day,
      window_end_day: sourceJob.window_end_day,
      time_window_start: sourceJob.time_window_start,
      time_window_end: sourceJob.time_window_end,
      is_recurring: sourceJob.is_recurring,
      // Scheduling dates
      specific_dates: sourceJob.specific_dates,
      start_date: sourceJob.start_date,
      end_date: sourceJob.end_date,
      exclude_dates: sourceJob.exclude_dates,
      preferred_employee_id: sourceJob.preferred_employee_id,
      // Always DRAFT for duplicates
      status: 'DRAFT' as const,
      customer_id: sourceJob.customer_id,
      created_by: sourceJob.created_by,
      // Legacy fields
      available_days: sourceJob.available_days || [],
      frequency_per_week: sourceJob.frequency_per_week || null,
    }

    const { data: newJob, error: insertError } = await supabase
      .from('job_templates')
      .insert(duplicate)
      .select()
      .single()

    if (insertError || !newJob) {
      console.error('Error inserting duplicate job:', insertError)
      return null
    }

    // 4. Fetch source steps with checklist items and images
    const { data: sourceSteps } = await supabase
      .from('job_steps')
      .select('*')
      .eq('job_template_id', sourceJobId)
      .order('step_order', { ascending: true })

    if (sourceSteps && sourceSteps.length > 0) {
      for (const step of sourceSteps) {
        // Insert the step
        const { data: newStep, error: stepError } = await supabase
          .from('job_steps')
          .insert({
            job_template_id: newJob.id,
            step_order: step.step_order,
            title: step.title,
            description: step.description,
            products_needed: step.products_needed,
          })
          .select()
          .single()

        if (stepError || !newStep) {
          console.error('Error duplicating step:', stepError)
          continue
        }

        // Fetch and insert checklist items
        const { data: checklistItems } = await supabase
          .from('job_step_checklist')
          .select('*')
          .eq('job_step_id', step.id)
          .order('item_order', { ascending: true })

        if (checklistItems && checklistItems.length > 0) {
          const newChecklistItems = checklistItems.map(item => ({
            job_step_id: newStep.id,
            item_text: item.item_text,
            item_order: item.item_order,
          }))

          const { error: checklistError } = await supabase
            .from('job_step_checklist')
            .insert(newChecklistItems)

          if (checklistError) {
            console.error('Error duplicating checklist items:', checklistError)
          }
        }

        // Fetch and insert images (same URLs, not re-uploaded)
        const { data: stepImages } = await supabase
          .from('job_step_images')
          .select('*')
          .eq('job_step_id', step.id)
          .order('image_order', { ascending: true })

        if (stepImages && stepImages.length > 0) {
          const newImages = stepImages.map(img => ({
            job_step_id: newStep.id,
            image_url: img.image_url,
            image_order: img.image_order,
            caption: img.caption,
          }))

          const { error: imagesError } = await supabase
            .from('job_step_images')
            .insert(newImages)

          if (imagesError) {
            console.error('Error duplicating step images:', imagesError)
          }
        }
      }
    }

    return newJob.id
  } catch (error) {
    console.error('Error in duplicateJob:', error)
    return null
  }
}
