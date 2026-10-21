// src/components/profile/EditProfileModalV4.tsx
// PENORA Blockchain — Creator Profile Edit Modal (V4 Spatial Glass)
import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, AlertCircle, Edit3, Sparkles } from 'lucide-react';
import { updateProfile } from '../../lib/api/profiles';

interface EditProfileModalV4Props {
  isOpen: boolean;
  onClose: () => void;
  currentDisplayName: string;
  currentBio: string;
  profileId: string;
  onProfileSaved: (updated: { display_name: string; bio: string }) => void;
}

export const EditProfileModalV4: React.FC<EditProfileModalV4Props> = ({
  isOpen,
  onClose,
  currentDisplayName,
  currentBio,
  profileId,
  onProfileSaved,
}) => {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [bio, setBio] = useState(currentBio);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentDisplayName);
      setBio(currentBio);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentDisplayName, currentBio]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();

    if (trimmedName.length > 50) {
      setErrorMessage('Display name cannot exceed 50 characters.');
      return;
    }
    if (trimmedBio.length > 300) {
      setErrorMessage('Bio cannot exceed 300 characters.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await updateProfile(profileId, {
      display_name: trimmedName,
      bio: trimmedBio,
    });

    setIsSaving(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Profile updated successfully!');
      onProfileSaved({
        display_name: trimmedName,
        bio: trimmedBio,
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="pn-card max-w-lg w-full p-6 sm:p-7 space-y-5 bg-white border border-[#007C8B]/20 shadow-2xl relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-modal-title"
      >
        {/* Signature V4 Teal Gradient Hairline */}
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
              <h2 id="edit-profile-modal-title" className="pn-h2 text-lg sm:text-xl text-[#0A2540]">
                Edit Creator Profile
              </h2>
              <p className="text-xs text-[#4A5B70] mt-0.5">
                Update your public display name and creator bio on PENORA.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="field-display-name" className="pn-field-label !mb-0">
                Display Name
              </label>
              <span
                className={`text-[11px] font-mono ${
                  displayName.length > 45 ? 'text-amber-600 font-bold' : 'text-[#6E7D90]'
                }`}
              >
                {displayName.length} / 50
              </span>
            </div>
            <input
              id="field-display-name"
              type="text"
              value={displayName}
              maxLength={50}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your public display name..."
              disabled={isSaving}
              className="pn-input"
            />
          </div>

          {/* Bio Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="field-creator-bio" className="pn-field-label !mb-0">
                Creator Bio
              </label>
              <span
                className={`text-[11px] font-mono ${
                  bio.length > 270 ? 'text-amber-600 font-bold' : 'text-[#6E7D90]'
                }`}
              >
                {bio.length} / 300
              </span>
            </div>
            <textarea
              id="field-creator-bio"
              value={bio}
              maxLength={300}
              rows={4}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell readers about your domain expertise, publications, and curation focus..."
              disabled={isSaving}
              className="pn-input font-normal resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0A2540]/8">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="pn-btn pn-btn-secondary pn-btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (displayName === currentDisplayName && bio === currentBio)}
              className="pn-btn pn-btn-brand pn-btn-sm px-5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
