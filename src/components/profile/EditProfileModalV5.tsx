// src/components/profile/EditProfileModalV5.tsx
// PENORA Blockchain — Creator Profile Edit Modal V5
// Supports Display Name, Bio, Location, Website, Interests tags, and real Avatar/Cover uploads.
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  Loader2,
  AlertCircle,
  Edit3,
  Camera,
  Image as ImageIcon,
  MapPin,
  Globe,
  Tag,
  Plus,
  Trash2,
} from 'lucide-react';
import { updateProfile } from '../../lib/api/profiles';
import { uploadCreatorMedia, validateImageFile } from '../../lib/api/storage';

interface EditProfileModalV5Props {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  initialDisplayName: string;
  initialBio: string;
  initialLocation?: string;
  initialWebsite?: string;
  initialInterests?: string[];
  initialAvatarUrl?: string;
  initialCoverUrl?: string;
  onProfileSaved: (updated: {
    display_name: string;
    bio: string;
    location?: string;
    website?: string;
    interests?: string[];
    avatar_url?: string;
    cover_url?: string;
  }) => void;
}

export const EditProfileModalV5: React.FC<EditProfileModalV5Props> = ({
  isOpen,
  onClose,
  profileId,
  initialDisplayName,
  initialBio,
  initialLocation = '',
  initialWebsite = '',
  initialInterests = [],
  initialAvatarUrl = '',
  initialCoverUrl = '',
  onProfileSaved,
}) => {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [location, setLocation] = useState(initialLocation);
  const [website, setWebsite] = useState(initialWebsite);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [newTagInput, setNewTagInput] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string>(initialAvatarUrl);
  const [coverPreview, setCoverPreview] = useState<string>(initialCoverUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(initialDisplayName);
      setBio(initialBio);
      setLocation(initialLocation);
      setWebsite(initialWebsite);
      setInterests(initialInterests.length > 0 ? initialInterests : ['Writing', 'Tech', 'Faith', 'Productivity', 'Onchain']);
      setAvatarPreview(initialAvatarUrl);
      setCoverPreview(initialCoverUrl);
      setAvatarFile(null);
      setCoverFile(null);
      setNewTagInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [
    isOpen,
    initialDisplayName,
    initialBio,
    initialLocation,
    initialWebsite,
    initialInterests,
    initialAvatarUrl,
    initialCoverUrl,
  ]);

  if (!isOpen) return null;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid avatar image.');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid cover image.');
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleAddInterestTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();

    const cleaned = newTagInput.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (cleaned.length > 25) {
      setErrorMessage('Tag cannot exceed 25 characters.');
      return;
    }
    if (interests.length >= 10) {
      setErrorMessage('Maximum 10 interest tags allowed.');
      return;
    }
    if (interests.some(t => t.toLowerCase() === cleaned.toLowerCase())) {
      setErrorMessage('Tag already added.');
      return;
    }

    setInterests([...interests, cleaned]);
    setNewTagInput('');
    setErrorMessage(null);
  };

  const handleRemoveInterestTag = (tagToRemove: string) => {
    setInterests(interests.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();
    const trimmedLoc = location.trim();
    const trimmedWeb = website.trim();

    // Validation
    if (trimmedName.length > 50) {
      setErrorMessage('Display name cannot exceed 50 characters.');
      return;
    }
    if (trimmedBio.length > 300) {
      setErrorMessage('Bio cannot exceed 300 characters.');
      return;
    }
    if (trimmedLoc.length > 50) {
      setErrorMessage('Location cannot exceed 50 characters.');
      return;
    }
    if (trimmedWeb) {
      try {
        const u = new URL(trimmedWeb);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          setErrorMessage('Website must be a valid http or https URL.');
          return;
        }
      } catch {
        setErrorMessage('Please enter a valid website URL (e.g. https://yourdomain.com).');
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let finalAvatarUrl = avatarPreview;
    let finalCoverUrl = coverPreview;

    // Upload files if selected
    if (avatarFile) {
      const uploadRes = await uploadCreatorMedia(avatarFile, 'avatar');
      if (uploadRes.error && !uploadRes.isPendingBucket) {
        setIsSaving(false);
        setErrorMessage(`Avatar upload failed: ${uploadRes.error}`);
        return;
      }
      if (uploadRes.publicUrl) {
        finalAvatarUrl = uploadRes.publicUrl;
      }
    }

    if (coverFile) {
      const uploadRes = await uploadCreatorMedia(coverFile, 'cover');
      if (uploadRes.error && !uploadRes.isPendingBucket) {
        setIsSaving(false);
        setErrorMessage(`Cover upload failed: ${uploadRes.error}`);
        return;
      }
      if (uploadRes.publicUrl) {
        finalCoverUrl = uploadRes.publicUrl;
      }
    }

    // Save profile metadata
    const res = await updateProfile(profileId, {
      display_name: trimmedName,
      bio: trimmedBio,
      location: trimmedLoc,
      website: trimmedWeb,
      interests: interests,
      avatar_url: finalAvatarUrl,
      cover_url: finalCoverUrl,
    });

    setIsSaving(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Creator profile saved successfully!');
      onProfileSaved({
        display_name: trimmedName,
        bio: trimmedBio,
        location: trimmedLoc,
        website: trimmedWeb,
        interests: interests,
        avatar_url: finalAvatarUrl,
        cover_url: finalCoverUrl,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('penora:profile-updated', {
            detail: {
              avatar_url: finalAvatarUrl,
              display_name: trimmedName,
              bio: trimmedBio,
              location: trimmedLoc,
              website: trimmedWeb,
              interests: interests,
              cover_url: finalCoverUrl,
            },
          })
        );
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className="pn-card max-w-xl w-full p-6 sm:p-7 space-y-5 bg-white border border-[#007C8B]/25 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-v5-title"
      >
        {/* Signature Cyan Top Accent */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#007C8B] via-[#00E5F4] to-[#0A2540]"
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#007C8B]/10 text-[#007C8B] flex items-center justify-center border border-[#007C8B]/20 flex-shrink-0">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-profile-v5-title" className="pn-h2 text-lg sm:text-xl text-[#0A2540]">
                Edit Creator Profile V5
              </h2>
              <p className="text-xs text-[#4A5B70] mt-0.5">
                Update your identity, visual branding, bio, and creator tags.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-lg text-[#6E7D90] hover:text-[#0A2540] hover:bg-[#F4F7FA] transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Visual Media Pickers: Cover & Avatar */}
          <div className="space-y-3">
            <span className="pn-field-label !mb-0 block">Visual Branding</span>
            
            {/* Cover Preview & Trigger */}
            <div className="relative h-28 w-full rounded-xl overflow-hidden bg-[#0A2540] border border-[#0A2540]/15 group">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-[#0A2540] via-[#0B2D4E] to-[#007C8B]" />
              )}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-xs border border-white/20"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-[#00E5F4]" />
                  <span>Change Cover Banner</span>
                </button>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleCoverSelect}
                className="hidden"
              />
            </div>

            {/* Avatar Row */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-100 border-2 border-[#00E5F4] shadow-sm flex items-center justify-center">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="font-bold text-lg text-[#007C8B]">
                      {(displayName[0] || 'C').toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#007C8B] hover:bg-[#00606B] text-white flex items-center justify-center shadow-md border border-white"
                  aria-label="Upload Avatar"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0A2540]">Profile Avatar</p>
                <p className="text-[11px] text-[#4A5B70]">
                  JPG, PNG, WebP up to 5MB.
                </p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="field-v5-name" className="pn-field-label !mb-0">
                Display Name
              </label>
              <span className={`text-[11px] font-mono ${displayName.length > 45 ? 'text-amber-600 font-bold' : 'text-[#6E7D90]'}`}>
                {displayName.length} / 50
              </span>
            </div>
            <input
              id="field-v5-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
              required
              className="pn-input w-full"
              placeholder="e.g. Fatima Zahra"
            />
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="field-v5-bio" className="pn-field-label !mb-0">
                Bio
              </label>
              <span className={`text-[11px] font-mono ${bio.length > 280 ? 'text-amber-600 font-bold' : 'text-[#6E7D90]'}`}>
                {bio.length} / 300
              </span>
            </div>
            <textarea
              id="field-v5-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="pn-input w-full resize-none text-xs sm:text-sm"
              placeholder="Tell other creators about your perspectives and work..."
            />
          </div>

          {/* Location & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-v5-location" className="pn-field-label flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>Location</span>
              </label>
              <input
                id="field-v5-location"
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                maxLength={50}
                className="pn-input w-full text-xs"
                placeholder="e.g. Lahore, Pakistan"
              />
            </div>
            <div>
              <label htmlFor="field-v5-website" className="pn-field-label flex items-center gap-1.5 mb-1">
                <Globe className="h-3.5 w-3.5 text-[#007C8B]" />
                <span>Website</span>
              </label>
              <input
                id="field-v5-website"
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="pn-input w-full text-xs"
                placeholder="https://yoursite.com"
              />
            </div>
          </div>

          {/* Creator Interests Chips */}
          <div>
            <label className="pn-field-label flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>Creator Interests & Tags</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interests.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#007C8B]/10 text-[#007C8B] border border-[#007C8B]/20"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveInterestTag(tag)}
                    className="hover:text-red-500 transition-colors ml-0.5"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {interests.length < 10 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={handleAddInterestTag}
                  placeholder="Add a tag (e.g. Onchain)"
                  className="pn-input flex-1 text-xs"
                  maxLength={25}
                />
                <button
                  type="button"
                  onClick={handleAddInterestTag}
                  className="pn-btn pn-btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0A2540]/8">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="pn-btn pn-btn-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="pn-btn pn-btn-brand px-6 py-2 text-xs font-semibold flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
