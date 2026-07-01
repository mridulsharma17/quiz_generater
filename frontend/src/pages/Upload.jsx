import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ref as dbRef, push, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import { UploadCloud, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Upload = () => {
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'text'
  const [file, setFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [topics, setTopics] = useState('');
  
  const [status, setStatus] = useState('idle'); // idle, uploading, generating, success, error
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const extension = selectedFile.name.split('.').pop().toLowerCase();
      
      if (allowedTypes.includes(selectedFile.type) || ['pdf', 'docx', 'txt'].includes(extension)) {
        setFile(selectedFile);
        setErrorMsg('');
      } else {
        setFile(null);
        setErrorMsg('Invalid file type. Please upload a PDF, DOCX, or TXT file.');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputMode === 'file' && !file) {
      setErrorMsg('Please select a file first.');
      return;
    }
    if (inputMode === 'text' && (!textContent || textContent.trim() === '')) {
      setErrorMsg('Please enter some study material text first.');
      return;
    }

    try {
      setStatus('generating');
      
      // 1. Send data to backend to generate quiz
      const formData = new FormData();
      if (inputMode === 'file') {
        formData.append('document', file);
      } else {
        formData.append('textContent', textContent);
      }
      formData.append('difficulty', difficulty);
      formData.append('numQuestions', numQuestions);
      formData.append('topics', topics);

      const response = await axios.post('/api/generate-quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const generatedQuiz = response.data.quiz;

      // Navigate to Quiz taking page with in-memory state
      console.log("Generated Quiz:", generatedQuiz);

      setStatus('success');
      
      setTimeout(() => {
        navigate('/quiz/session', { 
          state: { 
            quizData: {
              topic: topics || (inputMode === 'file' ? file.name : 'Pasted Text'),
              difficulty: difficulty || "Medium",
              questions: generatedQuiz
            }
          } 
        });
      }, 1500);

    } catch (error) {
      console.error(error);
      setStatus('error');
      
      const errorText = error.response?.data?.error || error.response?.data || error.message || '';
      
      if (typeof errorText === 'string' && (errorText.includes('FUNCTION_INVOCATION_FAILED') || errorText.includes('500'))) {
        setErrorMsg('Server is temporarily unavailable. Please try again later.');
      } else {
        setErrorMsg(error.response?.data?.error || error.message || 'An error occurred during generation.');
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Generate New Quiz</h1>
        <p className="text-gray-400 mb-8">Upload your study material and let AI create a tailored quiz for you.</p>

        <div className="grid md:grid-cols-5 gap-8">
          
          <div className="md:col-span-3 space-y-6">
            {/* Input Mode Selector Tabs */}
            <div className="flex gap-2 p-1 bg-gray-900/50 border border-gray-800 rounded-xl max-w-xs">
              <button
                type="button"
                onClick={() => { setInputMode('file'); setErrorMsg(''); }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                  inputMode === 'file'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => { setInputMode('text'); setErrorMsg(''); }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                  inputMode === 'text'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                Enter Text
              </button>
            </div>

            {inputMode === 'file' ? (
              <div 
                className={`glass-panel border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                  file ? 'border-cyan-400 bg-cyan-400/5' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".pdf,.docx,.txt"
                />
                
                {!file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <UploadCloud className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Drag & Drop your document</h3>
                    <p className="text-gray-400 mb-6 text-sm">Supported files: PDF, DOCX, TXT (Max 10MB)</p>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="glass-button-outline text-sm"
                    >
                      Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-cyan-900/50 rounded-full flex items-center justify-center mb-4">
                      <File className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-cyan-400">{file.name}</h3>
                    <p className="text-gray-400 mb-6 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button 
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Remove File
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-200">Study Text Material</h3>
                  <span className="text-xs text-gray-400">
                    {textContent.length} characters
                  </span>
                </div>
                <textarea
                  className="glass-input min-h-[250px] w-full resize-none font-sans p-4 focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm leading-relaxed"
                  placeholder="Paste your study notes, summary, articles, or learning text here to generate a customized quiz..."
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    if (e.target.value.trim()) setErrorMsg('');
                  }}
                />
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
              <h3 className="text-xl font-bold mb-6 border-b border-gray-700 pb-4">Quiz Settings</h3>
              
              <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                  <select 
                    className="glass-input appearance-none cursor-pointer"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="Easy" className="bg-gray-800">Easy</option>
                    <option value="Medium" className="bg-gray-800">Medium</option>
                    <option value="Hard" className="bg-gray-800">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Number of Questions</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20"
                    className="glass-input" 
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Specific Topics (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Photosynthesis, Chapter 2"
                    className="glass-input" 
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                  />
                </div>

                <div className="mt-auto pt-6">
                  <button 
                    type="submit" 
                    disabled={
                      status === 'generating' || 
                      status === 'uploading' || 
                      (inputMode === 'file' && !file) || 
                      (inputMode === 'text' && (!textContent || !textContent.trim()))
                    }
                    className="glass-button w-full h-12 relative overflow-hidden"
                  >
                    {status === 'generating' && <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Generating AI Quiz...</span>}
                    {status === 'uploading' && <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Saving Data...</span>}
                    {status === 'success' && <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Success! Redirecting...</span>}
                    {status === 'idle' || status === 'error' ? 'Generate Quiz' : ''}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
