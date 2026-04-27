/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Download, 
  Scissors, 
  Sparkles, 
  Loader2, 
  X, 
  CheckCircle2,
  AlertCircle,
  Columns,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface SlicedPart {
  id: number;
  dataUrl: string;
  enhancedUrl: string | null;
  status: 'idle' | 'processing' | 'completed' | 'error';
}

export default function App() {
  const [originalCollage, setOriginalCollage] = useState<string | null>(null);
  const [parts, setParts] = useState<SlicedPart[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalCollage(dataUrl);
      splitImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const splitImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = img.width;
      const h = img.height;
      const partWidth = Math.floor(w / 3);
      const newParts: SlicedPart[] = [];

      for (let i = 0; i < 3; i++) {
        const startX = i * partWidth;
        const currentPartWidth = (i === 2) ? (w - startX) : partWidth;

        canvas.width = currentPartWidth;
        canvas.height = h;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          startX, 0, currentPartWidth, h, // Source
          0, 0, currentPartWidth, h // Destination
        );
        newParts.push({
          id: i + 1,
          dataUrl: canvas.toDataURL('image/png'),
          enhancedUrl: null,
          status: 'idle'
        });
      }
      setParts(newParts);
    };
    img.src = dataUrl;
  };

  const enhancePart = async (index: number) => {
    const part = parts[index];
    if (part.status === 'processing') return;

    setParts(prev => prev.map((p, i) => 
      i === index ? { ...p, status: 'processing' } : p
    ));

    try {
      const base64Data = part.dataUrl.split(',')[1];
      const mimeType = 'image/png';

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Enhance this image to high definition (4K). Focus on sharpening details, improving clarity, and balancing colors while strictly maintaining the original composition and content. Do not add any new elements or borders. Return ONLY the enhanced image.",
            },
          ],
        },
      });

      let enhancedData: string | null = null;
      for (const p of response.candidates?.[0]?.content?.parts || []) {
        if (p.inlineData) {
          enhancedData = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
          break;
        }
      }

      if (enhancedData) {
        setParts(prev => prev.map((p, i) => 
          i === index ? { ...p, status: 'completed', enhancedUrl: enhancedData } : p
        ));
      } else {
        throw new Error('Failed to enhance');
      }
    } catch (err) {
      setParts(prev => prev.map((p, i) => 
        i === index ? { ...p, status: 'error' } : p
      ));
    }
  };

  const enhanceAll = async () => {
    setIsProcessing(true);
    for (let i = 0; i < parts.length; i++) {
      await enhancePart(i);
    }
    setIsProcessing(false);
  };

  const downloadPart = (url: string, id: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `part-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setOriginalCollage(null);
    setParts([]);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#1c1e21] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Scissors size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">AI Collage Slicer</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Split & Enhance System</p>
            </div>
          </div>
          
          {parts.length > 0 && (
            <div className="flex items-center gap-4">
              <button 
                onClick={reset}
                className="text-sm font-semibold text-gray-400 hover:text-red-500 transition-colors"
              >
                إعادة تعيين
              </button>
              {parts.every(p => p.status === 'completed') ? (
                <button
                  onClick={() => parts.forEach(p => p.enhancedUrl && downloadPart(p.enhancedUrl, p.id))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Download size={16} />
                  <span>تحميل الكل</span>
                </button>
              ) : (
                <button
                  onClick={enhanceAll}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  <span>تحسين جميع الأجزاء</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!originalCollage ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
              relative border-4 border-dashed rounded-[2.5rem] p-20 flex flex-col items-center justify-center transition-all duration-500
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
              min-h-[500px] cursor-pointer group shadow-xl
            `}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              accept="image/*"
              className="hidden"
            />
            <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-8 text-blue-500 group-hover:scale-110 transition-transform duration-500">
              <Upload size={48} />
            </div>
            <h2 className="text-3xl font-black mb-4 text-center">ارفع صورة الكولاج (3 في 1)</h2>
            <p className="text-gray-400 text-center max-w-md text-lg">
              سنقوم بتقسيم صورتك المدمجة أفقياً إلى 3 أجزاء منفصلة وتحسين جودتها تلقائياً.
            </p>
            <div className="mt-12 flex items-center gap-4 text-gray-300">
              <div className="w-12 h-16 border-2 border-current rounded-md flex items-center justify-center text-xs font-bold">1</div>
              <ArrowRight size={20} />
              <div className="w-12 h-16 border-2 border-current rounded-md flex items-center justify-center text-xs font-bold">2</div>
              <ArrowRight size={20} />
              <div className="w-12 h-16 border-2 border-current rounded-md flex items-center justify-center text-xs font-bold">3</div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-12">
            {/* Original Preview */}
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Columns size={16} />
                  صورة الكولاج الأصلية
                </h3>
              </div>
              <div className="relative rounded-2xl overflow-hidden border border-gray-100">
                <img src={originalCollage} alt="Collage" className="w-full h-auto block" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 flex">
                  <div className="flex-1 border-r-2 border-dashed border-white/50 bg-black/5 flex items-end p-4 text-white font-black text-4xl opacity-50">01</div>
                  <div className="flex-1 border-r-2 border-dashed border-white/50 bg-black/5 flex items-end p-4 text-white font-black text-4xl opacity-50">02</div>
                  <div className="flex-1 bg-black/5 flex items-end p-4 text-white font-black text-4xl opacity-50">03</div>
                </div>
              </div>
            </section>

            {/* Sliced Parts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {parts.map((part, index) => (
                <motion.div
                  key={part.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-black text-blue-600 uppercase tracking-tighter">الجزء {part.id}</span>
                    {part.status === 'completed' && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 size={12} /> تم التحسين
                      </span>
                    )}
                  </div>
                  
                  <div className="relative bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden group min-h-[300px] flex items-center justify-center">
                    <img 
                      src={part.enhancedUrl || part.dataUrl} 
                      alt={`Part ${part.id}`} 
                      className={`max-w-full max-h-full w-auto h-auto transition-all duration-700 ${part.status === 'processing' ? 'blur-md scale-110 opacity-50' : ''}`}
                      referrerPolicy="no-referrer"
                    />

                    {/* Processing Overlay */}
                    {part.status === 'processing' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-sm">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <span className="text-xs font-black text-blue-700 uppercase tracking-widest">جاري التحسين...</span>
                      </div>
                    )}

                    {/* Error Overlay */}
                    {part.status === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/90">
                        <AlertCircle className="text-red-500 mb-2" size={32} />
                        <span className="text-xs font-bold text-red-600">فشل التحسين</span>
                        <button onClick={() => enhancePart(index)} className="mt-4 text-xs underline font-bold">إعادة المحاولة</button>
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                      <button 
                        onClick={() => downloadPart(part.enhancedUrl || part.dataUrl, part.id)}
                        className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                      >
                        <Download size={18} />
                        تحميل
                      </button>
                      {part.status === 'idle' && (
                        <button 
                          onClick={() => enhancePart(index)}
                          className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                        >
                          <Sparkles size={18} />
                          تحسين الجودة
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-gray-200 mt-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">النظام</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              نظام ذكي لتقسيم الصور المدمجة (Collage) وتحسين كل جزء بشكل منفصل باستخدام أحدث تقنيات الذكاء الاصطناعي.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">التقنية</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              يعتمد النظام على محرك Gemini 2.5 Flash لمعالجة الصور ورفع دقتها إلى مستويات احترافية.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">المطور</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              تم التصميم والبرمجة لتقديم تجربة مستخدم سلسة واحترافية.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
