import { supabase } from '@/integrations/supabase/client';
import type { Template, Block, Page } from '@/types/notion';
import { createPage } from './pageAPI';

/**
 * Template API - Operations for templates
 */

/**
 * Get all available templates (system + user's custom templates)
 */
export async function getTemplates(): Promise<Template[]> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Query templates: system templates + user's custom templates
  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${user.id}`)
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get templates: ${error.message}`);
  }

  return (templates || []) as Template[];
}

/**
 * Create a page from a template
 */
export async function createPageFromTemplate(
  templateId: string,
  title?: string,
  parentId?: string | null
): Promise<Page> {
  // Get the template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) {
    throw new Error(`Failed to get template: ${templateError.message}`);
  }

  if (!template) {
    throw new Error('Template not found');
  }

  // Create a new page with the template content
  const pageTitle = title || template.name;
  const pageIcon = template.icon;
  const pageContent = template.content as Block[];

  // Create the page
  const page = await createPage({
    title: pageTitle,
    icon: pageIcon,
    parent_id: parentId,
    content: pageContent,
  });

  return page;
}

/**
 * Create a custom template from a page
 */
export async function createTemplate(
  name: string,
  content: Block[],
  description?: string,
  icon?: string
): Promise<Template> {
  // Validate name
  if (!name || name.trim().length === 0) {
    throw new Error('Template name is required');
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Prepare template data
  const templateData = {
    user_id: user.id,
    name: name.trim(),
    description: description || null,
    icon: icon || null,
    content: content,
    is_system: false,
  };

  // Insert template
  const { data: template, error } = await supabase
    .from('templates')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return template as Template;
}

/**
 * Create a template from an existing page
 */
export async function createTemplateFromPage(
  pageId: string,
  name: string,
  description?: string
): Promise<Template> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Get the page
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('*')
    .eq('id', pageId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (pageError) {
    throw new Error(`Failed to get page: ${pageError.message}`);
  }

  if (!page) {
    throw new Error('Page not found or access denied');
  }

  // Create template from page content
  return createTemplate(
    name,
    page.content as Block[],
    description,
    page.icon || undefined
  );
}

/**
 * Delete a custom template (only user's own templates)
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Delete template (RLS will ensure user can only delete their own)
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', user.id)
    .eq('is_system', false);

  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`);
  }
}
