-- Store the full extracted text from each tender file so the chat AI can read it
ALTER TABLE tender_files
  ADD COLUMN IF NOT EXISTS extracted_text text;
