import React, { useState, useEffect } from "react";
import { Memory, MediaFile } from "../types";
import { api } from "../api";
import { 
  Heart, Plus, Search, Filter, Calendar, MapPin, Tag, Image, Video, Mic, 
  Trash2, Edit, X, Upload, Play, Film, AlertCircle, Loader, Eye
} from "lucide-react";

interface MemoryVaultProps {
  onMemoryChanged: () => void;
  guestMode?: boolean;
}

export default function MemoryVault({ onMemoryChanged, guestMode }: MemoryVaultProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all"); // 'all', 'image', 'video', 'audio'

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [aiDescribing, setAiDescribing] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const data = await api.getMemories();
      setMemories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load memories");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingMemory(null);
    setTitle("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setLocation("");
    setTagsInput("");
    setMediaFiles([]);
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (memory: Memory) => {
    setEditingMemory(memory);
    setTitle(memory.title);
    setDescription(memory.description);
    setDate(memory.date);
    setLocation(memory.location);
    setTagsInput(memory.tags.join(", "));
    setMediaFiles(memory.media);
    setError("");
    setIsFormOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(10); // Start progress bar

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));

        // Read file as Base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        // Call our full-stack server upload endpoint!
        const result = await api.uploadFile(file.name, base64Data, mediaType);

        const newMedia: MediaFile = {
          id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: mediaType,
          url: result.url,
          name: result.name
        };

        setMediaFiles(prev => [...prev, newMedia]);

        // Auto-generate description for uploaded image using Gemini API on backend
        if (mediaType === "image") {
          setAiDescribing(true);
          try {
            const descResult = await api.describeImage(base64Data);
            if (descResult && descResult.description) {
              setDescription(prev => {
                const prefix = prev ? prev.trim() + "\n\n" : "";
                return prefix + `📸 [AI Memory Vision: ${descResult.description}]`;
              });
            }
          } catch (descErr) {
            console.error("AI image description failed:", descErr);
          } finally {
            setAiDescribing(false);
          }
        }
      }
    } catch (err: any) {
      setError("File upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !date) {
      setError("Title, description, and date are required.");
      return;
    }

    const parsedTags = tagsInput
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      title,
      description,
      date,
      location,
      tags: parsedTags,
      media: mediaFiles
    };

    try {
      if (editingMemory) {
        await api.updateMemory(editingMemory.id, payload);
      } else {
        await api.createMemory(payload);
      }
      setIsFormOpen(false);
      fetchMemories();
      onMemoryChanged(); // Trigger dashboard update
    } catch (err: any) {
      setError(err.message || "Failed to save memory");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this memory?")) return;
    try {
      await api.deleteMemory(id);
      fetchMemories();
      onMemoryChanged();
    } catch (err: any) {
      setError(err.message || "Failed to delete memory");
    }
  };

  // Extract all unique tags across memories for filters
  const allTags = Array.from(new Set(memories.flatMap(m => m.tags)));

  // Filter memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = selectedTag ? m.tags.includes(selectedTag) : true;

    const matchesMedia = mediaFilter === "all" 
      ? true 
      : m.media.some(f => f.type === mediaFilter);

    return matchesSearch && matchesTag && matchesMedia;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div id="memory-vault-root" className="space-y-6 animate-fade-in">
      <div id="vault-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <Heart className="w-6 h-6 text-[#1A1A1A]" />
            <span>Memory Vault</span>
          </h2>
          <p className="text-[#1A1A1A]/70 text-xs">Preserve the stories, milestones, pictures, and records of your lifetime in high-fidelity capsules.</p>
        </div>
        {!guestMode && (
          <button
            id="add-memory-btn"
            onClick={handleOpenCreateForm}
            className="px-5 py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Memory</span>
          </button>
        )}
      </div>

      {/* Filters Panel */}
      <div id="filters-panel" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#F1EFEC] p-4 rounded-none border border-[#E5E5E1]">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#E5E5E1] rounded-none px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-[#1A1A1A]/50" />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="bg-transparent text-[#1A1A1A] text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="all" className="bg-white">All Media Types</option>
            <option value="image" className="bg-white">Photos Only</option>
            <option value="video" className="bg-white">Videos Only</option>
            <option value="audio" className="bg-white">Voice recordings</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#E5E5E1] rounded-none px-3 py-1.5">
          <Tag className="w-3.5 h-3.5 text-[#1A1A1A]/50" />
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-transparent text-[#1A1A1A] text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="" className="bg-white">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag} className="bg-white">{tag}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => { setSearchQuery(""); setSelectedTag(""); setMediaFilter("all"); }}
          className="text-xs text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors cursor-pointer text-left md:text-center font-bold uppercase tracking-wider underline decoration-1"
        >
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-none text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Memories Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#1A1A1A]/70 gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
          <span className="text-xs font-medium uppercase tracking-wider">Accessing your Memory Vault...</span>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-none border border-[#E5E5E1] p-6">
          <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-serif italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>No Memories Found</h3>
          <p className="text-[#1A1A1A]/60 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            {searchQuery || selectedTag || mediaFilter !== "all" 
              ? "No items match your active filters. Try resetting search fields."
              : "Welcome to your story ledger. Record your birth origins, childhood moments, achievements, or values."}
          </p>
          {!guestMode && !searchQuery && !selectedTag && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer"
            >
              Log your First Memory
            </button>
          )}
        </div>
      ) : (
        <div id="memories-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMemories.map(memory => {
            const firstImage = memory.media.find(f => f.type === "image");
            return (
              <div 
                key={memory.id} 
                className="group rounded-none bg-white border border-[#E5E5E1] overflow-hidden shadow-sm hover:border-[#1A1A1A] transition-all flex flex-col justify-between"
              >
                {/* Memory Cover Thumbnail */}
                <div className="relative aspect-video w-full bg-[#F1EFEC] overflow-hidden border-b border-[#E5E5E1]">
                  {firstImage ? (
                    <img 
                      src={firstImage.url} 
                      alt={memory.title} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#1A1A1A]/40">
                      <Heart className="w-8 h-8 text-[#1A1A1A]/30" />
                      <span className="text-[9px] uppercase tracking-widest font-bold mt-2">Text Memoir</span>
                    </div>
                  )}

                  {/* Media Count Pills */}
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {memory.media.some(f => f.type === "image") && (
                      <span className="p-1 bg-white/90 border border-[#E5E5E1] text-[#1A1A1A] text-[10px]"><Image className="w-3.5 h-3.5" /></span>
                    )}
                    {memory.media.some(f => f.type === "video") && (
                      <span className="p-1 bg-white/90 border border-[#E5E5E1] text-[#1A1A1A] text-[10px]"><Video className="w-3.5 h-3.5" /></span>
                    )}
                    {memory.media.some(f => f.type === "audio") && (
                      <span className="p-1 bg-white/90 border border-[#E5E5E1] text-[#1A1A1A] text-[10px]"><Mic className="w-3.5 h-3.5" /></span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] text-[#1A1A1A]/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-[#1A1A1A]/60" />
                      <span>{new Date(memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </span>
                    <h4 className="font-serif italic text-xl text-[#1A1A1A] group-hover:text-[#1A1A1A] transition-colors tracking-tight line-clamp-1" style={{ fontFamily: "Georgia, serif" }}>{memory.title}</h4>
                    <p className="text-xs text-[#1A1A1A]/80 line-clamp-3 leading-relaxed font-sans">{memory.description}</p>
                  </div>

                  <div className="pt-4 border-t border-[#E5E5E1]">
                    {memory.location && (
                      <span className="text-[10px] text-[#1A1A1A]/70 flex items-center gap-1 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-[#1A1A1A]/60" />
                        <span>{memory.location}</span>
                      </span>
                    )}

                    <div className="flex flex-wrap gap-1 mb-4">
                      {memory.tags.map(t => (
                        <span key={t} className="text-[9px] font-bold px-2 py-0.5 bg-[#F1EFEC] text-[#1A1A1A]/80 border border-[#E5E5E1]">#{t}</span>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <button 
                        onClick={() => setViewingMemory(memory)}
                        className="text-xs text-[#1A1A1A] hover:opacity-85 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>

                      {!guestMode && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleOpenEditForm(memory)}
                            className="p-1.5 hover:bg-[#F1EFEC] border border-transparent hover:border-[#E5E5E1] text-[#1A1A1A] cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMemory(memory.id)}
                            className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-200 text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD / Upload Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-none max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col text-[#1A1A1A] shadow-2xl">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center bg-white">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                {editingMemory ? "Edit Memory Entry" : "Record New Life Memory"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#1A1A1A]/60 hover:text-[#1A1A1A] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Childhood summers at grandmother's barn"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Detailed Description / Story</label>
                  {aiDescribing && (
                    <span className="text-[10px] text-amber-700 font-bold animate-pulse flex items-center gap-1 bg-amber-50 px-2 py-0.5 border border-amber-200">
                      <Loader className="w-3 h-3 animate-spin text-amber-600" />
                      AI writing photo caption...
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="Record your thoughts, lessons, dialogues, and insights from this moment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Estimated Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="E.g., Seattle, WA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="childhood, travel, lessons, family"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              {/* Media Upload Options */}
              <div className="space-y-2 pt-2 border-t border-[#E5E5E1]">
                <label className="text-xs font-bold text-[#1A1A1A]/70 uppercase tracking-wider flex items-center justify-between">
                  <span>Attach Media Files</span>
                  <span className="text-[10px] text-[#1A1A1A]/50">Supports multi-photo, video, &amp; audio</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors rounded-none">
                    <Image className="w-5 h-5 text-[#1A1A1A] mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "image")}
                    />
                  </label>

                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors rounded-none">
                    <Video className="w-5 h-5 text-[#1A1A1A] mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]">Add Video</span>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "video")}
                    />
                  </label>

                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors rounded-none">
                    <Mic className="w-5 h-5 text-[#1A1A1A] mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]">Voice Record</span>
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "audio")}
                    />
                  </label>
                </div>

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#1A1A1A] font-bold uppercase">
                      <span>Uploading to secure media servers...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-[#E5E5E1] rounded-none overflow-hidden">
                      <div className="h-full bg-[#1A1A1A]" style={{ width: `${uploadProgress || 10}%` }}></div>
                    </div>
                  </div>
                )}

                {/* File Previews List */}
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mediaFiles.map(file => (
                      <div key={file.id} className="relative p-2 border border-[#E5E5E1] rounded-none bg-white flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {file.type === "image" && <Image className="w-4 h-4 text-[#1A1A1A] flex-shrink-0" />}
                          {file.type === "video" && <Video className="w-4 h-4 text-[#1A1A1A] flex-shrink-0" />}
                          {file.type === "audio" && <Mic className="w-4 h-4 text-[#1A1A1A] flex-shrink-0" />}
                          <span className="truncate text-[11px] text-[#1A1A1A] font-medium pr-4">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(file.id)}
                          className="text-[#1A1A1A]/60 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E5E5E1] flex justify-end gap-3 bg-white -mx-6 -mb-6 p-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E1] hover:bg-[#F1EFEC] rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer text-[#1A1A1A]/75"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Entry Viewer Modal */}
      {viewingMemory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-none max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col text-[#1A1A1A] shadow-2xl">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center bg-white">
              <div>
                <span className="text-[10px] text-[#1A1A1A]/60 font-bold uppercase tracking-wider">Memory Capsule details</span>
                <h3 className="font-serif italic text-2xl text-[#1A1A1A] mt-0.5" style={{ fontFamily: "Georgia, serif" }}>{viewingMemory.title}</h3>
              </div>
              <button onClick={() => setViewingMemory(null)} className="p-1 text-[#1A1A1A]/60 hover:text-[#1A1A1A] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Media Attachments Carousel / Players */}
              {viewingMemory.media.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest">Media Attachments ({viewingMemory.media.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {viewingMemory.media.map(file => (
                      <div key={file.id} className="border border-[#E5E5E1] bg-white p-3 rounded-none flex flex-col items-center">
                        {file.type === "image" && (
                          <div className="w-full aspect-video rounded-none overflow-hidden mb-2 border border-[#E5E5E1]">
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {file.type === "video" && (
                          <div className="w-full mb-2">
                            <video src={file.url} controls className="w-full rounded-none border border-[#E5E5E1] max-h-[200px]" />
                          </div>
                        )}
                        {file.type === "audio" && (
                          <div className="w-full py-6 flex flex-col items-center justify-center bg-[#F1EFEC] rounded-none border border-[#E5E5E1] mb-2">
                            <Mic className="w-8 h-8 text-[#1A1A1A] mb-2" />
                            <audio src={file.url} controls className="w-[80%]" />
                          </div>
                        )}
                        <span className="text-[10px] text-[#1A1A1A]/70 truncate max-w-xs">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Story Content */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest">The story</h4>
                <p className="text-sm text-[#1A1A1A] leading-relaxed bg-white border border-[#E5E5E1] p-5 rounded-none whitespace-pre-line font-sans">
                  {viewingMemory.description}
                </p>
              </div>

              {/* Details and tags */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E5E5E1] text-xs">
                <div className="space-y-1.5">
                  <span className="text-[#1A1A1A]/50 font-bold uppercase tracking-wider text-[10px]">Capsuled on</span>
                  <p className="text-[#1A1A1A] font-semibold">{new Date(viewingMemory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                {viewingMemory.location && (
                  <div className="space-y-1.5">
                    <span className="text-[#1A1A1A]/50 font-bold uppercase tracking-wider text-[10px]">Location</span>
                    <p className="text-[#1A1A1A] font-semibold">{viewingMemory.location}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1 pt-4">
                {viewingMemory.tags.map(t => (
                  <span key={t} className="text-[10px] font-bold px-3 py-1 bg-[#F1EFEC] text-[#1A1A1A]/80 border border-[#E5E5E1]">#{t}</span>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E1] flex justify-end bg-white">
              <button
                onClick={() => setViewingMemory(null)}
                className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer"
              >
                Close Capsule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
