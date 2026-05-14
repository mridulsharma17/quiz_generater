import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

export const parseDocument = async (file) => {
  const { originalname, buffer, mimetype } = file;
  const extension = originalname.split('.').pop().toLowerCase();

  try {
    let text = '';

    if (extension === 'pdf' || mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      text = data.text;
    } else if (extension === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: buffer });
      text = result.value;
    } else if (extension === 'txt' || mimetype === 'text/plain') {
      text = buffer.toString('utf-8');
    } else {
      throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT.');
    }

    return text;
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error('Failed to parse document: ' + error.message);
  }
};
