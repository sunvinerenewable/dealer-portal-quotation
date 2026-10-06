import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { useLoading } from '../../context/LoadingContext';
import { storageService } from '../../services/storageService';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';
import DocumentPreviewModal from '../Shared/DocumentPreviewModal';
import CameraCaptureModal from '../Shared/CameraCaptureModal';
import EditCustomerFileModal from '../Shared/EditCustomerFileModal';
import CancelCustomerFileModal from '../Shared/CancelCustomerFileModal';
import { CustomerCardSkeleton, DocumentVaultSkeleton } from '../Shared/Skeleton';
import { formatFileSize } from '../../utils/mediaOptimizer';
import { normalizeDocList, appendDocsToFileList, removeDocFromFileList, getCancellationRetentionStatus } from '../../utils/documentUtils';
import { GROUPED_SOLAR_BANKS } from '../../data/solarBanksData';
import SolarBankSelectorModal from '../Shared/SolarBankSelectorModal';
import {
  getDocumentListForFile,
  getDocumentCompletion,
  getDocumentSchemaKey,
  DOCUMENT_SCHEMAS
} from '../../data/defaultRequiredDocuments';

export default function StaffManagement() {
  const {
    staffList,
    customerFiles,
    dealers,
    addStaff,
    updateStaff,
    updateStaffPassword,
    deleteStaff,
    addCustomerFile,
    updateCustomerFile,
    editCustomerFile,
    cancelCustomerFile,
    restoreCustomerFile,
    deleteCustomerFile,
    updateFileStatus,
    isHardwareDbSyncing,
    refreshCustomerFiles,
    refreshStaffList,
    customerFilesError,
    masterDocRegistry,
    categoryDocRules,
    getFileDocuments,
    getFileDocsCompletion,
    highlightedFileId,
    role,
    currentStaff,
    currentDealer
  } = useApp();

  const { addToast } = useToast();

  // Main UI section: 'files' (Customer Files) or 'staff' (Sales Team Directory)
  // Preserved across page refreshes via ?tab=staff / ?view=staff query parameter
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openFile')) return 'files';
      const val = (params.get('tab') || params.get('view') || '').toLowerCase();
      if (['staff', 'directory', 'logins', 'sales_team', 'sales'].includes(val)) {
        return 'staff';
      }
      if (['files', 'customer_files', 'subsidies', 'pipeline'].includes(val)) {
        return 'files';
      }
    }
    return 'files';
  });



  // Auto-scroll to highlighted file from Push Notification
  React.useEffect(() => {
    if (highlightedFileId) {
      setActiveView('files');
      setTimeout(() => {
        const el = document.getElementById(`admin-file-card-${highlightedFileId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightedFileId]);

  // Keep URL query parameter synchronized with active view
  const handleViewChange = (viewKey) => {
    setActiveView(viewKey);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', viewKey);
      if (url.searchParams.has('view')) {
        url.searchParams.set('view', viewKey);
      }
      window.history.replaceState({ ...window.history.state, subtab: viewKey }, '', url.toString());
    }
  };

  // Browser back/forward navigation sync
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const val = (params.get('tab') || params.get('view') || '').toLowerCase();
        if (['staff', 'directory', 'logins', 'sales_team', 'sales'].includes(val)) {
          setActiveView('staff');
        } else if (['files', 'customer_files', 'subsidies', 'pipeline'].includes(val)) {
          setActiveView('files');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // Files pipeline filter: 'all', 'Sourced', 'Verification', 'DISCOM Registered', 'Subsidized'
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [fileToEdit, setFileToEdit] = useState(null);
  const [fileToCancel, setFileToCancel] = useState(null);
  const [selectedFileForDocs, setSelectedFileForDocs] = useState(null);
  const [selectedFileForTimeline, setSelectedFileForTimeline] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [cameraTargetDoc, setCameraTargetDoc] = useState(null);
  const [cameraUploadProgress, setCameraUploadProgress] = useState(0);
  const [cameraIsUploading, setCameraIsUploading] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // Staff Credentials & User Management State
  const [selectedStaffForCreds, setSelectedStaffForCreds] = useState(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffRole, setEditStaffRole] = useState('Field Sales Executive');
  const [editStaffDepartment, setEditStaffDepartment] = useState('Sales');
  const [editStaffZone, setEditStaffZone] = useState('');
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState('all');

  const handleOpenStaffCreds = (member) => {
    setSelectedStaffForCreds(member);
    setEditStaffName(member.name || '');
    setEditStaffPhone(member.phone || '');
    setEditStaffEmail(member.email || '');
    setEditStaffRole(member.role || 'Field Sales Executive');
    const isVer = String(member.department || '').toLowerCase() === 'verification' || String(member.role || '').toLowerCase().includes('verification');
    setEditStaffDepartment(isVer ? 'Verification' : (member.department || 'Sales'));
    setEditStaffZone(member.zone || '');
    setEditStaffPassword(member.password || 'Sunvine@2026');
    setShowStaffPassword(false);
  };

  const handleSaveStaffCredentials = async (e) => {
    if (e) e.preventDefault();
    if (!selectedStaffForCreds) return;
    if (!editStaffName.trim() || !editStaffPhone.trim()) {
      addToast('Name and Mobile Number are required.', 'error');
      return;
    }
    const cleanPhone = String(editStaffPhone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      addToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    const isVerification = editStaffRole.toLowerCase().includes('verification') || editStaffDepartment === 'Verification';
    const dept = isVerification ? 'Verification' : 'Sales';
    const updated = {
      name: editStaffName.trim(),
      phone: cleanPhone,
      email: editStaffEmail.trim() || `${cleanPhone}@sunvine.in`,
      role: editStaffRole,
      department: dept,
      zone: editStaffZone,
      password: editStaffPassword.trim() || 'Sunvine@2026'
    };
    if (updateStaff) {
      await updateStaff(selectedStaffForCreds.id, updated);
    }
    if (updateStaffPassword && editStaffPassword.trim()) {
      await updateStaffPassword(selectedStaffForCreds.id, editStaffPassword.trim());
    }
    addToast(`Staff credentials & profile updated for ${editStaffName}!`, 'success');
    setSelectedStaffForCreds(null);
  };

  const handleConfirmDeleteStaff = () => {
    if (!staffToDelete) return;
    if (deleteStaff) {
      deleteStaff(staffToDelete.id);
    }
    addToast(`Staff member "${staffToDelete.name}" (${staffToDelete.id}) deleted.`, 'info');
    setStaffToDelete(null);
    if (selectedStaffForCreds?.id === staffToDelete.id) {
      setSelectedStaffForCreds(null);
    }
  };

  // New Staff Form State (Auto-Incrementing Staff ID)
  const computeNextStaffId = () => {
    const existingNums = (staffList || [])
      .map(s => parseInt(String(s.id || s.staffId || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 801;
    return `STF-${String(nextNum).padStart(3, '0')}`;
  };

  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffDepartment, setNewStaffDepartment] = useState('Sales');
  const [newStaffRole, setNewStaffRole] = useState('Field Sales Executive');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('Sunvine@2026');

  const handleOpenAddStaffModal = () => {
    setNewStaffId(computeNextStaffId());
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setNewStaffRole('Field Sales Executive');
    setNewStaffDepartment('Sales');
    setNewStaffPassword('Sunvine@2026');
    setShowAddStaffModal(true);
  };

  // New File Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCoApplicantName, setNewCustCoApplicantName] = useState('');
  const [newCustCoApplicantPhone, setNewCustCoApplicantPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustDiscom, setNewCustDiscom] = useState('UGVCL');
  const [newCustConsumerNo, setNewCustConsumerNo] = useState('');
  const [newCustCategory, setNewCustCategory] = useState('residential');
  const [newCustSolarKw, setNewCustSolarKw] = useState('4.4');
  const [newCustStaffId, setNewCustStaffId] = useState(staffList?.[0]?.id || 'STF-801');
  const [newCustSourceType, setNewCustSourceType] = useState('DIRECT_STAFF');
  const [newCustDealerId, setNewCustDealerId] = useState('');
  const [newCustFinanceType, setNewCustFinanceType] = useState('CASH');
  const [newCustLoanBank, setNewCustLoanBank] = useState('State Bank of India (Surya Ghar Loan)');
  const [newCustLoanRef, setNewCustLoanRef] = useState('');

  const { showLoader, hideLoader } = useLoading();

  // Document Upload Handlers (Optional - uploads directly to Cloudflare R2)
  const handleUploadDoc = async (fileId, docKey, filesInput = 'document.pdf') => {
    const file = customerFiles.find(f => f.id === fileId);
    if (!file || !filesInput) return;

    const fileList = filesInput instanceof FileList || Array.isArray(filesInput)
      ? Array.from(filesInput)
      : [filesInput];
    if (fileList.length === 0) return;

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    showLoader(`Securing ${fileList.length > 1 ? `${fileList.length} files` : 'document'} in Cloudflare R2 Vault...`);
    try {
      const uploadedDocsList = [];

      for (const item of fileList) {
        if (typeof item === 'object' && item.name) {
          const fileExt = item.name?.split('.').pop()?.toLowerCase() || '';
          const isAllowed = allowedExts.includes(fileExt) || allowedMimes.includes(item.type?.toLowerCase());

          if (!isAllowed) {
            addToast(`File "${item.name}" invalid format. Only PDF & Images are allowed.`, 'error');
            continue;
          }
          if (item.size > 2 * 1024 * 1024) {
            const sizeMB = (item.size / 1024 / 1024).toFixed(2);
            addToast(`File "${item.name}" (${sizeMB} MB) exceeds maximum 2 MB limit allowed.`, 'error');
            continue;
          }

          try {
            const uploadRes = await storageService.uploadCustomerDocument(item, fileId, docKey);
            if (uploadRes?.success) {
              uploadedDocsList.push({
                filename: uploadRes.filename || item.name,
                url: uploadRes.publicUrl || uploadRes.url,
                sizeBytes: uploadRes.fileSize || item.size,
                size: formatFileSize(uploadRes.fileSize || item.size),
                uploaded: true,
                date: new Date().toISOString().split('T')[0]
              });
            }
          } catch (err) {
            console.warn('[StaffManagement] Cloudflare R2 upload error for', item.name, err);
            addToast(err.message || `Failed to upload ${item.name}`, 'error');
          }
        } else if (typeof item === 'string') {
          uploadedDocsList.push({
            filename: item,
            url: null,
            sizeBytes: null,
            size: 'Attached',
            uploaded: true,
            date: new Date().toISOString().split('T')[0]
          });
        }
      }

      if (uploadedDocsList.length > 0) {
        const existingSlot = file.documents?.[docKey];
        const updatedSlot = appendDocsToFileList(existingSlot, uploadedDocsList);

        const updatedDocs = {
          ...file.documents,
          [docKey]: updatedSlot
        };

        await updateCustomerFile(fileId, { documents: updatedDocs });

        if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
          setSelectedFileForDocs(prev => ({
            ...prev,
            documents: updatedDocs
          }));
        }

        addToast(
          uploadedDocsList.length > 1
            ? `${uploadedDocsList.length} documents secured in R2 Vault`
            : `Document secured in R2: ${uploadedDocsList[0].filename}`,
          'success'
        );
      }
    } catch (e) {
      console.error('[StaffManagement] handleUploadDoc failed:', e);
      addToast(e.message || 'Failed to upload document', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleDeleteDoc = async (fileId, docKey, targetDocIdOrUrl = null) => {
    const file = customerFiles.find(f => f.id === fileId);
    if (!file) return;
    const slotData = file.documents?.[docKey];
    if (!slotData) return;

    showLoader('Removing document from Cloudflare R2 Vault...');
    try {
      const fileList = normalizeDocList(slotData);
      const targetDoc = targetDocIdOrUrl
        ? fileList.find(f => f.id === targetDocIdOrUrl || f.url === targetDocIdOrUrl || f.filename === targetDocIdOrUrl)
        : null;

      if (targetDoc && (targetDoc.url || targetDoc.path)) {
        await storageService.deleteDocument(targetDoc.url || targetDoc.path);
      } else if (!targetDocIdOrUrl) {
        for (const f of fileList) {
          if (f.url || f.path) {
            await storageService.deleteDocument(f.url || f.path);
          }
        }
        await storageService.deleteCustomerDocument(docKey, fileId, 'sunvine-documents', slotData);
      }

      let updatedDocs = { ...(file.documents || {}) };
      if (targetDocIdOrUrl) {
        const updatedSlot = removeDocFromFileList(slotData, targetDocIdOrUrl);
        if (!updatedSlot.uploaded || updatedSlot.files.length === 0) {
          delete updatedDocs[docKey];
        } else {
          updatedDocs[docKey] = updatedSlot;
        }
      } else {
        delete updatedDocs[docKey];
      }

      await updateCustomerFile(fileId, { documents: updatedDocs });

      if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
        setSelectedFileForDocs(prev => ({
          ...prev,
          documents: updatedDocs
        }));
      }

      addToast('Document removed from Cloudflare R2', 'info');
    } catch (e) {
      console.error('[StaffManagement] handleDeleteDoc failed:', e);
      addToast(e.message || 'Failed to remove document', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleCameraCapture = async (statsOrList) => {
    if (!selectedFileForDocs || !cameraTargetDoc || !statsOrList) return;
    const docKey = cameraTargetDoc.key;
    const fileId = selectedFileForDocs.id;
    const items = Array.isArray(statsOrList) ? statsOrList : [statsOrList];

    setCameraIsUploading(true);
    setCameraUploadProgress(10);
    const prog = setInterval(() => setCameraUploadProgress(p => Math.min(p + 8, 75)), 250);

    try {
      const uploadedDocsList = [];

      for (let i = 0; i < items.length; i++) {
        const stats = items[i];
        let fileUrl = null;
        let filename = stats.file?.name || stats.name || `${docKey}_media_${Date.now().toString(36)}_${i + 1}.${stats.isPdf ? 'pdf' : 'jpg'}`;
        let fileSize = stats.compressedSize || stats.file?.size || 0;

        if (stats.file) {
          try {
            const uploadRes = await storageService.uploadCustomerDocument(stats.file, fileId, docKey);
            if (uploadRes?.publicUrl || uploadRes?.url) {
              fileUrl = uploadRes.publicUrl || uploadRes.url;
              fileSize = uploadRes.fileSize || stats.file.size;
              filename = uploadRes.filename || stats.file.name;
            }
          } catch (err) {
            console.warn('[StaffManagement] Media upload warning for', filename, err);
          }
        }

        uploadedDocsList.push({
          filename,
          url: fileUrl,
          size: stats.compressedFormatted || formatFileSize(fileSize),
          originalSize: stats.originalFormatted,
          reduction: stats.reduction,
          dataUrl: fileUrl ? undefined : stats.dataUrl,
          uploaded: true,
          date: new Date().toISOString().split('T')[0]
        });
      }

      clearInterval(prog);
      setCameraUploadProgress(100);
      await new Promise(r => setTimeout(r, 400));

      if (uploadedDocsList.length > 0) {
        const existingSlot = selectedFileForDocs.documents?.[docKey];
        const updatedSlot = appendDocsToFileList(existingSlot, uploadedDocsList);
        const updatedDocs = { ...(selectedFileForDocs.documents || {}), [docKey]: updatedSlot };

        if (updateCustomerFile) {
          await updateCustomerFile(selectedFileForDocs.id, { documents: updatedDocs });
        }
        setSelectedFileForDocs(prev => ({ ...prev, documents: updatedDocs }));
        setCameraTargetDoc(null);
        addToast(
          uploadedDocsList.length > 1
            ? `${uploadedDocsList.length} files attached to vault`
            : `File attached: ${uploadedDocsList[0].filename}`,
          'success'
        );
      }
    } catch (e) {
      clearInterval(prog);
      console.error('[StaffManagement] Media upload error:', e);
      addToast(e.message || 'Media upload failed', 'error');
    } finally {
      setCameraIsUploading(false);
      setCameraUploadProgress(0);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPhone.trim()) {
      addToast('Please provide Name and Mobile Number', 'error');
      return;
    }
    const cleanPhone = String(newStaffPhone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      addToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    const newId = newStaffId.trim() || computeNextStaffId();
    const isVerification = newStaffDepartment === 'Verification' || newStaffRole.toLowerCase().includes('verification');
    const newStaff = {
      id: newId,
      name: newStaffName.trim(),
      role: newStaffRole.trim() || (isVerification ? 'Verification Desk Officer' : 'Field Sales Executive'),
      department: isVerification ? 'Verification' : 'Sales',
      phone: cleanPhone,
      email: newStaffEmail.trim() || `${newStaffName.toLowerCase().replace(/\s+/g, '.')}@sunvine.in`,
      password: newStaffPassword.trim() || 'Sunvine@2026',
      totalFiles: 0,
      registeredFiles: 0,
      subsidizedFiles: 0,
      pipelineKw: 0,
      status: 'Active'
    };
    if (addStaff) {
      await addStaff(newStaff);
    }
    setShowAddStaffModal(false);
    setNewStaffId('');
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setNewStaffRole('Field Sales Executive');
    setNewStaffDepartment('Sales');
    setNewStaffPassword('Sunvine@2026');
    addToast(`Staff member "${newStaff.name}" onboarded with ID: ${newId}!`, 'success');
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      addToast('Please provide Customer Name and Mobile', 'error');
      return;
    }
    const assignedStaff = staffList.find(s => s.id === newCustStaffId) || staffList[0];
    const matchedDealer = newCustSourceType === 'DEALER' ? (dealers || []).find(d => d.id === newCustDealerId) : null;
    const newFileId = `FIL-2026-${String((customerFiles || []).length + 85).padStart(3, '0')}`;
    const isLoanCase = newCustFinanceType === 'LOAN' || newCustFinanceType === 'BANK_LOAN' || newCustFinanceType === 'FINANCE_LOAN';
    const newFile = {
      id: newFileId,
      customerName: newCustName.trim(),
      phone: newCustPhone.trim(),
      email: newCustEmail.trim() || null,
      coApplicantName: isLoanCase ? (newCustCoApplicantName.trim() || null) : null,
      coApplicantPhone: isLoanCase ? (newCustCoApplicantPhone.trim() || null) : null,
      address: newCustAddress.trim() || 'Gujarat, India',
      discom: newCustDiscom,
      consumerNo: newCustConsumerNo.trim() || `${newCustDiscom}-${Math.floor(100000 + Math.random() * 900000)}`,
      sanctionedLoadKw: parseFloat(newCustSolarKw) || 5.0,
      solarSystemKw: parseFloat(newCustSolarKw) || 3.3,
      category: newCustCategory || 'residential',
      roofType: 'RCC Terrace',
      staffId: assignedStaff.id,
      staffName: assignedStaff.name,
      sourceType: newCustSourceType,
      source: newCustSourceType === 'DEALER' ? 'DEALER' : 'DIRECT_STAFF',
      dealerId: matchedDealer ? matchedDealer.id : null,
      dealerName: matchedDealer ? (matchedDealer.firmName || matchedDealer.name) : null,
      financeType: newCustFinanceType,
      paymentMode: newCustFinanceType,
      loanBank: isLoanCase ? newCustLoanBank : null,
      loanRefNo: isLoanCase ? newCustLoanRef.trim() : null,
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      currentStage: 'LEAD_SOURCED',
      applicationNo: 'Draft Pending',
      documents: {}
    };

    if (addCustomerFile) {
      await addCustomerFile(newFile);
    }
    setShowAddFileModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustCoApplicantName('');
    setNewCustCoApplicantPhone('');
    setNewCustAddress('');
    setNewCustConsumerNo('');
    setNewCustLoanRef('');

    // Auto-open Document Vault modal for newly created file
    setSelectedFileForDocs(newFile);

    addToast(`New file ${newFileId} created for ${newFile.customerName}! You can upload documents now or skip.`, 'success');
  };

  const handleSaveStaffPassword = () => {
    if (!selectedStaffForCreds) return;
    if (!editStaffPassword.trim()) {
      addToast('Password cannot be empty', 'error');
      return;
    }
    updateStaffPassword(selectedStaffForCreds.id, editStaffPassword.trim());
    addToast(`Password updated for ${selectedStaffForCreds.name}`, 'success');
    setSelectedStaffForCreds(null);
  };

  const handleCopyCredentials = (member) => {
    const text = `Sunvine Solar Portal - Staff Login:\nURL: ${window.location.origin}\nStaff ID: ${member.id}\nMobile: ${member.phone}\nPassword: ${member.password || 'Sunvine@2026'}`;
    navigator.clipboard.writeText(text);
    addToast(`Login credentials copied for ${member.name}! Send to staff via WhatsApp.`, 'success');
  };

  // Active vs Cancelled breakdown
  const activeFiles = (customerFiles || []).filter(f => f.status !== 'Cancelled');
  const cancelledFiles = (customerFiles || []).filter(f => f.status === 'Cancelled');

  // Filtered files
  const filteredFiles = (customerFiles || []).filter(f => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      (f.customerName || '').toLowerCase().includes(term) ||
      (f.consumerNo || '').toLowerCase().includes(term) ||
      (f.phone || '').includes(term) ||
      (f.id || '').toLowerCase().includes(term) ||
      (f.staffName || '').toLowerCase().includes(term);

    const matchStatus =
      statusFilter === 'all'
        ? f.status !== 'Cancelled'
        : statusFilter === 'Cancelled'
        ? f.status === 'Cancelled'
        : f.status === statusFilter;

    const matchStaff = staffFilter === 'all' || f.staffId === staffFilter;

    return matchSearch && matchStatus && matchStaff;
  });

  // Pipeline stats (Active only)
  const totalFilesCount = activeFiles.length;
  const sourcedCount = activeFiles.filter(f => f.status === 'Sourced').length;
  const verificationCount = activeFiles.filter(f => f.status === 'Verification').length;
  const discomRegCount = activeFiles.filter(f => f.status === 'DISCOM Registered').length;
  const inProgressTotal = verificationCount + discomRegCount;
  const subsidizedCount = activeFiles.filter(f => f.status === 'Subsidized').length;
  const cancelledCount = cancelledFiles.length;
  const totalKwSum = activeFiles.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

  return (
    <div className="flex flex-col w-full pb-16 font-sans text-slate-800">
      <div className="max-w-[1520px] mx-auto w-full space-y-6">
        {/* Top Header matching DealerManagement */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E7EB] pb-5">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-secondary mb-1">
              <span>Admin Console</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Partner Directory</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-on-surface font-semibold">Sales Team &amp; Customer Files</span>
            </nav>
            <h1 className="font-poppins font-bold text-headline-xl text-[#0F1B2E] tracking-tight">
              Sales Team &amp; Customer Files
            </h1>
            <p className="text-body-md text-secondary mt-1">
              Live salesperson performance tracking, portal credentials, customer pipeline, and optional document vault.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleOpenAddStaffModal}
              className="h-10 px-3.5 sm:px-4 bg-white border border-[#E4E7EB] hover:border-primary text-on-surface font-label-md rounded-lg hover:bg-surface-container-low transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer text-xs sm:text-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">person_add</span>
              <span>Register New Staff</span>
            </button>
            <button
              onClick={() => setShowAddFileModal(true)}
              className="h-10 px-3.5 sm:px-4 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              <span>+ New Customer File</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Staff</div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1 font-mono">{(staffList || []).length}</div>
            <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              Active Accounts
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Files</div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1 font-mono">{totalFilesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">{totalKwSum} kW Pipeline</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sourced / Leads</div>
            <div className="text-2xl md:text-3xl font-black text-amber-600 mt-1 font-mono">{sourcedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">Initial Contact</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Progress</div>
            <div className="text-2xl md:text-3xl font-black text-blue-600 mt-1 font-mono">{inProgressTotal}</div>
            <div className="text-[11px] text-blue-600 mt-1 font-semibold">Verification / DISCOM</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Successful</div>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1 font-mono">{subsidizedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-1 font-semibold">DBT Approved &amp; Paid</div>
          </div>
        </div>

        {/* View Switcher: Files vs Staff Directory */}
        <div className="flex border-b border-[#E4E7EB] gap-6">
          <button
            onClick={() => handleViewChange('files')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${activeView === 'files'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span>
            <span>Customer Files &amp; Subsidies</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{totalFilesCount}</span>
          </button>
          <button
            onClick={() => handleViewChange('staff')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${activeView === 'staff'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span>Sales Team Directory &amp; Logins</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{(staffList || []).length}</span>
          </button>
        </div>

        {/* VIEW 1: CUSTOMER FILES & PIPELINE */}
        {activeView === 'files' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-[#E4E7EB] shadow-xs">
              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none shrink-0">
                {[
                  { key: 'all', label: `All Files (${totalFilesCount})` },
                  { key: 'Sourced', label: `Sourced (${sourcedCount})` },
                  { key: 'Verification', label: `Verification (${verificationCount})` },
                  { key: 'DISCOM Registered', label: `DISCOM Reg. (${discomRegCount})` },
                  { key: 'Subsidized', label: `Subsidized (${subsidizedCount})` },
                  { key: 'Cancelled', label: `Cancelled (${cancelledCount})`, isCancelledTab: true }
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${statusFilter === t.key
                      ? t.isCancelledTab
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-[#0F1B2E] text-white shadow-xs'
                      : t.isCancelledTab
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Staff and Search filters */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
                <select
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                  className="bg-white border border-[#E4E7EB] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer h-9 shrink-0 max-w-[160px] sm:max-w-none"
                >
                  <option value="all">All Sales Staff</option>
                  {(staffList || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.zone?.split(' ')[0] || 'HQ'})</option>
                  ))}
                </select>

                <div className="relative flex-1 sm:w-56 md:w-64 min-w-[140px]">
                  <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[16px] text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search name, phone, consumer no..."
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 h-9"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (isManualSyncing) return;
                    setIsManualSyncing(true);
                    try {
                      await Promise.allSettled([
                        refreshCustomerFiles ? refreshCustomerFiles({ force: true }) : Promise.resolve(),
                        refreshStaffList ? refreshStaffList({ force: true }) : Promise.resolve()
                      ]);
                      addToast('Live database sync complete.', 'success');
                    } catch (err) {
                      addToast('Database refresh finished.', 'info');
                    } finally {
                      setIsManualSyncing(false);
                    }
                  }}
                  disabled={isManualSyncing}
                  title="Live Database Sync"
                  className="h-9 px-3 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-600 hover:text-emerald-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <span className={`material-symbols-outlined text-[16px] text-emerald-600 ${isManualSyncing ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span className="hidden sm:inline text-[11px] font-medium">Refresh</span>
                </button>
              </div>
            </div>

            {/* Files Grid / Cards */}
            {customerFiles.length === 0 && (isHardwareDbSyncing || isManualSyncing) ? (
              <CustomerCardSkeleton count={6} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map(file => {
                  const docsCount = Object.values(file.documents || {}).filter(d => d.uploaded).length;
                  const statusColors = {
                    'Sourced': 'bg-amber-50 text-amber-800 border-amber-200',
                    'Verification': 'bg-blue-50 text-blue-800 border-blue-200',
                    'DISCOM Registered': 'bg-purple-50 text-purple-800 border-purple-200',
                    'Subsidized': 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    'Cancelled': 'bg-rose-50 text-rose-800 border-rose-200'
                  };

                  const isCancelled = file.status === 'Cancelled';
                  const isHighlighted = file.id === highlightedFileId;

                  return (
                    <div
                      id={`admin-file-card-${file.id}`}
                      key={file.id}
                      className={`rounded-xl p-5 flex flex-col justify-between transition-all animate-in fade-in duration-200 ${isHighlighted
                        ? 'bg-emerald-50/60 border-2 border-emerald-500 shadow-xl shadow-emerald-500/20 ring-2 ring-emerald-400'
                        : isCancelled
                        ? 'bg-slate-50/70 border border-rose-200 shadow-xs'
                        : 'bg-white border border-[#E4E7EB] hover:border-slate-300 shadow-xs'
                        }`}
                    >
                      <div>
                        {isHighlighted && (
                          <div className="mb-3 px-3 py-1.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1.5 animate-pulse">
                            <span className="material-symbols-outlined text-sm text-emerald-700">notifications_active</span>
                            <span>New Customer File Alert &bull; Opened from Push Notification</span>
                          </div>
                        )}
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">{file.id}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${file.sourceType === 'DEALER' || file.source === 'DEALER'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                {file.sourceType === 'DEALER' || file.source === 'DEALER' ? `Dealer (${file.dealerName || file.dealerId || 'Partner'})` : 'Direct Staff'}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${file.financeType === 'LOAN' || file.paymentMode === 'LOAN'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                {file.financeType === 'LOAN' || file.paymentMode === 'LOAN' ? `Loan (${file.loanBank ? file.loanBank.split(' ')[0] : 'Bank'})` : 'Cash Case'}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 hover:text-emerald-700 transition-colors truncate">
                              {file.customerName}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Edit & Delete Action Buttons (Active Files) */}
                            {!isCancelled && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFileToEdit(file)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                  title="Edit Customer File Details"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit_square</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFileToCancel(file)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Cancel or Delete File"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                                </button>
                              </>
                            )}

                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 ${statusColors[file.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {file.status}
                            </span>
                          </div>
                        </div>

                        {/* Cancellation Banner */}
                        {isCancelled && (() => {
                          const retention = getCancellationRetentionStatus(file.cancelledAt);
                          return (
                            <div className="mt-2.5 p-2.5 bg-rose-50/90 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                              <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">
                                {retention.isExpired ? 'lock_clock' : 'cancel'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-rose-900 flex items-center justify-between">
                                  <span>File Cancelled</span>
                                  {file.cancelledAt && (
                                    <span className="text-[10px] text-rose-500 font-normal">
                                      {new Date(file.cancelledAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>

                                {/* 14-Day Retention Warning Badge */}
                                <div className={`mt-1.5 p-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-semibold ${
                                  retention.isExpired 
                                    ? 'bg-rose-200/80 text-rose-950 border border-rose-300' 
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}>
                                  <span className="material-symbols-outlined text-[14px]">
                                    {retention.isExpired ? 'lock' : 'alarm'}
                                  </span>
                                  <span>
                                    {retention.isExpired
                                      ? 'Recovery period ended (Documents deleted)'
                                      : `Restorable for ${retention.formattedRemaining} (Until ${retention.expiryDateFormatted})`}
                                  </span>
                                </div>

                                <div className="text-[11px] text-rose-700 mt-1.5 break-words">
                                  <span className="font-semibold">Reason:</span> {file.cancellationReason || file.cancellation_reason || (file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED' || t.title?.includes('Cancelled'))?.notes) || 'No reason specified'}
                                </div>
                                {(file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor) && (
                                  <div className="text-[10px] text-rose-600 mt-0.5">
                                    Cancelled by: <span className="font-medium">
                                      {typeof (file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor) === 'object'
                                        ? (file.cancelledBy?.name || file.cancelledBy?.id || 'Authorized User')
                                        : (file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Info Pills */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <span className="text-slate-500 block text-[10px] font-medium">DISCOM / Consumer No</span>
                            <span className="font-bold text-slate-800">{file.discom}</span>
                            <span className="text-[11px] text-slate-500 block truncate">{file.consumerNo || 'Pending'}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <span className="text-slate-500 block text-[10px] font-medium">System &amp; Load</span>
                            <span className="font-bold text-emerald-700">{file.solarSystemKw} kW Solar</span>
                            <span className="text-[11px] text-slate-500 block">{file.sanctionedLoadKw} kW Load</span>
                          </div>
                        </div>

                        {/* Contact & Sales Executive */}
                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                            <a href={`tel:${file.phone}`} className="hover:underline text-slate-800 font-semibold">{file.phone}</a>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">person</span>
                            <span>Assigned: <strong className="text-slate-800">{file.staffName}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 truncate">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
                            <span className="truncate">{file.address}</span>
                          </div>
                        </div>

                        {/* Document Badges (Dynamic by Category: Residential, Bank Loan, Finance Loan) */}
                        {(() => {
                          const docCompletion = getFileDocsCompletion ? getFileDocsCompletion(file) : getDocumentCompletion(file, masterDocRegistry, categoryDocRules);
                          const docList = getFileDocuments ? getFileDocuments(file) : getDocumentListForFile(file, masterDocRegistry, categoryDocRules);
                          const schemaKey = getDocumentSchemaKey(file);
                          const schemaInfo = DOCUMENT_SCHEMAS[schemaKey];

                          return (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">folder_open</span>
                                  <span>{schemaInfo?.shortLabel || 'Docs'}</span>
                                </span>
                                <span className="font-bold text-emerald-700">{docCompletion.uploaded} / {docCompletion.total} Attached</span>
                              </div>
                              <div className={`grid gap-1 text-center ${docList.length <= 4 ? 'grid-cols-4' : (docList.length <= 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-4 sm:grid-cols-8')}`}>
                                {docList.map(doc => {
                                  const isUp = Boolean(file.documents?.[doc.key]?.uploaded || (doc.alias && file.documents?.[doc.alias]?.uploaded));
                                  return (
                                    <div
                                      key={doc.key}
                                      title={`${doc.label}: ${isUp ? 'Uploaded' : 'Pending'}`}
                                      className={`py-1 px-1 rounded flex flex-col items-center justify-center text-[9px] border transition-all ${isUp
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                        : 'bg-slate-50 border-slate-200 text-slate-400'
                                        }`}
                                    >
                                      <span className="truncate w-full">{doc.label.split(' ')[0]}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Action Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        {isCancelled ? (() => {
                          const retention = getCancellationRetentionStatus(file.cancelledAt);
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedFileForTimeline(file)}
                                className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="View History Timeline"
                              >
                                <span className="material-symbols-outlined text-[15px]">timeline</span>
                                <span>Timeline</span>
                              </button>

                              {retention.isExpired ? (
                                <button
                                  type="button"
                                  disabled
                                  className="flex-1 py-1.5 px-3 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                                  title="14-day recovery window has expired. This file cannot be restored."
                                >
                                  <span className="material-symbols-outlined text-[16px]">lock</span>
                                  <span>Recovery Locked</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await restoreCustomerFile(file.id);
                                      addToast(`Customer file ${file.id} restored to Sourced stage`, 'success');
                                    } catch (err) {
                                      addToast(err?.message || 'Failed to restore file', 'error');
                                    }
                                  }}
                                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                  title={`Restore to active pipeline (${retention.formattedRemaining} remaining)`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">history</span>
                                  <span>Restore File</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setFileToCancel(file)}
                                className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Permanently Delete File"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                                <span>Delete</span>
                              </button>
                            </>
                          );
                        })() : (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedFileForTimeline(file)}
                              className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="View Timeline & Advance Stage"
                            >
                              <span className="material-symbols-outlined text-[15px]">timeline</span>
                              <span>Timeline</span>
                            </button>

                            <button
                              onClick={() => setSelectedFileForDocs(file)}
                              className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[15px] text-emerald-600">upload_file</span>
                              <span>Docs (Optional)</span>
                            </button>

                            {/* Quick Status Advance */}
                            <select
                              value={file.status}
                              onChange={e => {
                                updateFileStatus(file.id, e.target.value);
                                addToast(`Updated status to "${e.target.value}"`, 'success');
                              }}
                              className="bg-white border border-[#E4E7EB] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                            >
                              <option value="Sourced">Sourced</option>
                              <option value="Verification">Verification</option>
                              <option value="DISCOM Registered">DISCOM Reg.</option>
                              <option value="Subsidized">Subsidized</option>
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredFiles.length === 0 && !(customerFiles.length === 0 && (isHardwareDbSyncing || isManualSyncing)) && (
              <div className="bg-white border border-[#E4E7EB] rounded-xl p-10 sm:p-14 text-center shadow-xs flex flex-col items-center justify-center max-w-2xl mx-auto my-4">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 ${customerFiles.length === 0 && customerFilesError ? 'bg-red-50 border-red-200 text-red-600'
                  : customerFiles.length === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                  <span className="material-symbols-outlined text-3xl">
                    {customerFiles.length === 0 && customerFilesError ? 'cloud_off' : customerFiles.length === 0 ? 'folder_open' : 'search_off'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                  {customerFiles.length === 0 && customerFilesError ? "Couldn't Load Customer Files"
                    : customerFiles.length === 0 ? 'No Customer Files Found'
                      : 'No Matching Customer Files'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                  {customerFiles.length === 0 && customerFilesError
                    ? 'The database could not be reached. Check your connection and try again.'
                    : customerFiles.length === 0
                      ? 'No customer solar files have been registered yet. Register the first customer file to get started.'
                      : 'No customer files match your search criteria or active filters.'}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (customerFiles.length === 0 && customerFilesError) {
                      setIsManualSyncing(true);
                      await refreshCustomerFiles();
                      setIsManualSyncing(false);
                    } else if (customerFiles.length === 0) {
                      setShowAddFileModal(true);
                    } else {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setStaffFilter('all');
                    }
                  }}
                  className="min-h-[44px] px-5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {customerFiles.length === 0 && customerFilesError ? 'refresh' : customerFiles.length === 0 ? 'note_add' : 'filter_alt_off'}
                  </span>
                  <span>
                    {customerFiles.length === 0 && customerFilesError ? 'Retry'
                      : customerFiles.length === 0 ? '+ New Customer File'
                        : 'Clear Filters & Search'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SALES TEAM DIRECTORY & LOGINS */}
        {activeView === 'staff' && (() => {
          const isVerDesk = (m) => String(m.department || '').toLowerCase() === 'verification' || String(m.role || '').toLowerCase().includes('verification');
          const displayedStaff = (staffList || []).filter(member => {
            if (staffDepartmentFilter === 'verification') return isVerDesk(member);
            if (staffDepartmentFilter === 'sales') return !isVerDesk(member);
            return true;
          });

          return (
            <div className="space-y-4">
              {/* Department Filter Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStaffDepartmentFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${staffDepartmentFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    All Staff ({(staffList || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffDepartmentFilter('sales')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${staffDepartmentFilter === 'sales' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Field Sales ({(staffList || []).filter(m => !isVerDesk(m)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffDepartmentFilter('verification')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${staffDepartmentFilter === 'verification' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Verification Desk ({(staffList || []).filter(isVerDesk).length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayedStaff.map(member => {
                  const isMemberVer = isVerDesk(member);
                  // Compute live individual salesperson metrics
                  const sFiles = (customerFiles || []).filter(f => f.staffId === member.id || f.staffName === member.name);
                  const totalBrought = sFiles.length;
                  const inProg = sFiles.filter(f => f.status === 'Verification' || f.status === 'DISCOM Registered').length;
                  const successDone = sFiles.filter(f => f.status === 'Subsidized').length;
                  const sKw = sFiles.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

                  return (
                    <div
                      key={member.id}
                      className="bg-white border border-[#E4E7EB] rounded-xl p-5 flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-base">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-base">{member.name}</h3>
                              <p className="text-[11px] text-slate-500 font-mono font-semibold">{member.id}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenStaffCreds(member)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                              title="Manage Profile & Credentials"
                            >
                              <span className="material-symbols-outlined text-[16px] text-amber-500">edit_square</span>
                            </button>
                            <button
                              onClick={() => setStaffToDelete(member)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete Staff Member"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-semibold ${isMemberVer ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {member.role}
                            </span>
                            {isMemberVer && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Verification Desk
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="material-symbols-outlined text-[14px]">call</span>
                            <a href={`tel:${member.phone}`} className="hover:underline text-slate-800 font-mono font-medium">{member.phone}</a>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 truncate">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            <span className="truncate">{member.zone}</span>
                          </div>
                        </div>

                        {/* Live 3-Column Salesperson Metrics */}
                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <div className="text-slate-500 text-[10px] font-medium">Total Files</div>
                            <div className="font-bold text-slate-900 text-sm mt-0.5">{totalBrought}</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <div className="text-blue-600 text-[10px] font-medium">In Progress</div>
                            <div className="font-bold text-blue-700 text-sm mt-0.5">{inProg}</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                            <div className="text-emerald-700 text-[10px] font-medium">Success</div>
                            <div className="font-bold text-emerald-700 text-sm mt-0.5">{successDone}</div>
                          </div>
                        </div>

                        <div className="mt-2 text-center text-[11px] text-slate-500">
                          Pipeline Capacity: <strong className="text-slate-900">{sKw} kW</strong>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <button
                          onClick={() => handleCopyCredentials(member)}
                          className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Copy WhatsApp Login Message"
                        >
                          <span className="material-symbols-outlined text-[14px] text-emerald-600">share</span>
                          <span>Credentials</span>
                        </button>

                        <button
                          onClick={() => {
                            setStaffFilter(member.id);
                            handleViewChange('files');
                          }}
                          className="text-emerald-600 hover:underline text-xs flex items-center gap-0.5 font-semibold cursor-pointer"
                        >
                          <span>View Files</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {displayedStaff.length === 0 && (
                <div className="bg-white border border-[#E4E7EB] rounded-xl p-10 sm:p-14 text-center shadow-xs flex flex-col items-center justify-center max-w-2xl mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl">group_off</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    {(staffList || []).length === 0 ? 'No Sales Staff Registered' : 'No Staff in Selected Department'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                    {(staffList || []).length === 0
                      ? 'Register sales executives and verification desk members to start assigning customer files.'
                      : 'No staff members found under the selected department filter.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => (staffList || []).length === 0 ? handleOpenAddStaffModal() : setStaffDepartmentFilter('all')}
                    className="min-h-[44px] px-4 bg-white border border-[#E4E7EB] hover:border-emerald-600 text-slate-900 font-semibold rounded-lg transition-colors flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">
                      {(staffList || []).length === 0 ? 'person_add' : 'groups'}
                    </span>
                    <span>{(staffList || []).length === 0 ? 'Register Sales Executive' : 'Show All Staff'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* MODAL 1: ADD NEW STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">group_add</span>
                <h3 className="font-bold text-slate-900 text-base">
                  Add New Staff Member
                </h3>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-4">
              {/* Auto-Incremented Staff ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff ID <span className="text-[11px] text-emerald-600 font-semibold">(Auto-Incremented)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaffId}
                  onChange={e => setNewStaffId(e.target.value)}
                  placeholder="e.g. STF-807"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Automatically computed from the highest staff number in the database.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={newStaffDepartment}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setNewStaffDepartment(dept);
                      setNewStaffRole(dept === 'Verification' ? 'Verification Desk Officer' : 'Field Sales Executive');
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Sales">Field Sales</option>
                    <option value="Verification">Verification Desk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    list="staffRolesList"
                    required
                    value={newStaffRole}
                    onChange={e => setNewStaffRole(e.target.value)}
                    placeholder="Type or pick role..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="staffRolesList">
                    <option value="Field Sales Executive" />
                    <option value="Area Sales Manager" />
                    <option value="Regional Solar Lead" />
                    <option value="Senior Solar Field Executive" />
                    <option value="Verification Desk Officer" />
                    <option value="Senior Technical Auditor" />
                    <option value="Document Verification Lead" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="e.g. Suresh V. Solanki"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 font-mono text-xs font-bold text-slate-600 select-none pointer-events-none flex items-center gap-1 z-10">
                      <span>+91</span>
                      <span className="text-slate-300 font-normal">|</span>
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={newStaffPhone}
                      onChange={e => setNewStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9825012345"
                      className="w-full pl-12 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    placeholder="staff@sunvine.in"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="text"
                  required
                  value={newStaffPassword}
                  onChange={e => setNewStaffPassword(e.target.value)}
                  placeholder="Sunvine@2026"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
                >
                  <span>Create Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STAFF CREDENTIALS & PASSWORD MANAGEMENT */}
      {selectedStaffForCreds && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E4E7EB] pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">manage_accounts</span>
                <span>Manage Staff Profile &amp; Credentials</span>
              </h3>
              <button onClick={() => setSelectedStaffForCreds(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStaffCredentials} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[11px]">System Staff ID:</span>
                  <span className="ml-1.5 font-bold font-mono text-slate-900">{selectedStaffForCreds.id}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  {selectedStaffForCreds.status || 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editStaffName}
                    onChange={e => setEditStaffName(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / Login ID *</label>
                  <input
                    type="tel"
                    required
                    value={editStaffPhone}
                    onChange={e => setEditStaffPhone(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editStaffEmail}
                    onChange={e => setEditStaffEmail(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role / Designation</label>
                  <input
                    type="text"
                    list="staffRolesList"
                    value={editStaffRole}
                    onChange={e => {
                      const newRole = e.target.value;
                      setEditStaffRole(newRole);
                      if (newRole.toLowerCase().includes('verification')) {
                        setEditStaffDepartment('Verification');
                      } else {
                        setEditStaffDepartment('Sales');
                      }
                    }}
                    placeholder="Type or pick role..."
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department / Portal Access</label>
                <select
                  value={editStaffDepartment}
                  onChange={e => setEditStaffDepartment(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Sales">Field Sales Department</option>
                  <option value="Verification">Verification &amp; KYC Desk</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Login Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={editStaffPassword}
                    onChange={e => setEditStaffPassword(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 pr-10 text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {showStaffPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setEditStaffPassword('Sunvine@2026')}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-[11px] text-slate-700 font-medium cursor-pointer"
                >
                  Reset to Sunvine@2026
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials({ ...selectedStaffForCreds, phone: editStaffPhone, password: editStaffPassword })}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  <span>Share on WhatsApp</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E4E7EB]">
                <button
                  type="button"
                  onClick={() => setStaffToDelete(selectedStaffForCreds)}
                  className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 border border-red-200 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Staff</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffForCreds(null)}
                    className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE STAFF MODAL */}
      {staffToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900">Delete Staff Member?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to delete <strong className="text-slate-900">{staffToDelete.name}</strong> ({staffToDelete.id})? Their portal access will be immediately terminated.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-lg border border-[#E4E7EB] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW CUSTOMER FILE */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E4E7EB] pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">note_add</span>
                <span>Create Customer Solar File</span>
              </h2>
              <button onClick={() => setShowAddFileModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="e.g. Bharatbhai M. Patel"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="+91 98250 99881"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Site Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Plot 10, Suryam Residency, Near Ring Road, Ahmedabad"
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">DISCOM</label>
                  <select
                    value={newCustDiscom}
                    onChange={e => setNewCustDiscom(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Consumer No (Optional)</label>
                  <input
                    type="text"
                    value={newCustConsumerNo}
                    onChange={e => setNewCustConsumerNo(e.target.value)}
                    placeholder="e.g. 03901/12345/6"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project Category *</label>
                  <select
                    value={newCustCategory}
                    onChange={e => setNewCustCategory(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
                  >
                    <option value="residential">Residential Rooftop</option>
                    <option value="commercial">Commercial & Industrial (C&I)</option>
                    <option value="common_meter">Housing Society / Common Meter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposed Solar (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={newCustSolarKw}
                    onChange={e => setNewCustSolarKw(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Customer Email & Payment / Case Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email ID (Optional)</label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={e => setNewCustEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment / Case Type</label>
                  <select
                    value={newCustFinanceType}
                    onChange={e => setNewCustFinanceType(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
                  >
                    <option value="CASH">100% Cash / Self Paid</option>
                    <option value="BANK_LOAN">Bank Loan (Nationalized / Commercial Bank)</option>
                    <option value="FINANCE_LOAN">Finance Loan (NBFC / FinTech Partner)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">File Source Type</label>
                  <select
                    value={newCustSourceType}
                    onChange={e => setNewCustSourceType(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="DIRECT_STAFF">Direct Sales Staff</option>
                    <option value="DEALER">Dealer Network Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Sales Staff</label>
                  <select
                    value={newCustStaffId}
                    onChange={e => setNewCustStaffId(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {(staffList || []).map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.zone}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newCustSourceType === 'DEALER' && (
                <div>
                  <label className="block text-xs font-semibold text-purple-800 mb-1">Select Associated Dealer</label>
                  <select
                    value={newCustDealerId}
                    onChange={e => setNewCustDealerId(e.target.value)}
                    className="w-full bg-purple-50/50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Choose Dealer Partner --</option>
                    {(dealers || []).map(d => (
                      <option key={d.id} value={d.id}>{d.firmName || d.name} ({d.id})</option>
                    ))}
                  </select>
                </div>
              )}

              {(newCustFinanceType === 'LOAN' || newCustFinanceType === 'BANK_LOAN' || newCustFinanceType === 'FINANCE_LOAN') && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-amber-700">account_balance</span>
                      <span>{newCustFinanceType === 'FINANCE_LOAN' ? 'NBFC Loan Details' : 'Bank Loan Details'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBankModal(true)}
                      className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">manage_search</span>
                      <span>Browse 40+ Official Banks</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Financing Partner / Bank</label>
                      <div className="flex gap-1.5">
                        <select
                          value={newCustLoanBank}
                          onChange={e => setNewCustLoanBank(e.target.value)}
                          className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {GROUPED_SOLAR_BANKS.map(group => (
                            <optgroup key={group.category} label={group.label}>
                              {group.banks.map(b => (
                                <option key={b.id} value={b.name}>
                                  {b.name} ({b.interestRate.split(' ')[0]})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowBankModal(true)}
                          className="px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer"
                          title="Browse All 40+ Banks"
                        >
                          <span className="material-symbols-outlined text-[15px]">search</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Loan Ref / App # (Optional)</label>
                      <input
                        type="text"
                        value={newCustLoanRef}
                        onChange={e => setNewCustLoanRef(e.target.value)}
                        placeholder="e.g. SBI-2026-9812"
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Co-Applicant fields for Loan cases */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Co-Applicant Name (Optional)</label>
                      <input
                        type="text"
                        value={newCustCoApplicantName}
                        onChange={e => setNewCustCoApplicantName(e.target.value)}
                        placeholder="e.g. Sunitaben B. Patel"
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">Co-Applicant Mobile (Optional)</label>
                      <input
                        type="tel"
                        value={newCustCoApplicantPhone}
                        onChange={e => setNewCustCoApplicantPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E4E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                >
                  Create Customer File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DYNAMIC DOCUMENT VAULT (Residential, Bank Loan, Finance Loan) */}
      {selectedFileForDocs && (() => {
        const docList = getFileDocuments ? getFileDocuments(selectedFileForDocs) : getDocumentListForFile(selectedFileForDocs, masterDocRegistry, categoryDocRules);
        const schemaKey = getDocumentSchemaKey(selectedFileForDocs);
        const schema = DOCUMENT_SCHEMAS[schemaKey];
        const docCompletion = getFileDocsCompletion ? getFileDocsCompletion(selectedFileForDocs) : getDocumentCompletion(selectedFileForDocs, masterDocRegistry, categoryDocRules);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-3xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-6 sm:my-8 max-h-[90vh] overflow-y-auto text-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-[#E4E7EB] pb-3 sm:pb-4 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-emerald-700 uppercase font-semibold">{selectedFileForDocs.id}</span>
                    <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {schema?.label || 'Document Vault'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                      {docCompletion.uploaded} of {docCompletion.total} Attached
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 truncate">
                    {selectedFileForDocs.customerName} — Document Vault
                  </h2>

                  {/* Customer Metadata Bar */}
                  <div className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1 flex-wrap">
                    <span>Mobile: <strong className="text-slate-800 font-semibold">{selectedFileForDocs.phone}</strong></span>
                    {selectedFileForDocs.email && (
                      <span>Email: <strong className="text-slate-800 font-semibold">{selectedFileForDocs.email}</strong></span>
                    )}
                    {selectedFileForDocs.consumerNo && (
                      <span>Consumer No: <strong className="text-slate-800">{selectedFileForDocs.consumerNo}</strong></span>
                    )}
                    <span>System: <strong className="text-emerald-700 font-bold">{selectedFileForDocs.solarSystemKw} kW</strong></span>
                    {selectedFileForDocs.coApplicantName && (
                      <span>Co-Applicant: <strong className="text-slate-800">{selectedFileForDocs.coApplicantName}</strong></span>
                    )}
                  </div>
                </div>

                <button onClick={() => setSelectedFileForDocs(null)} className="self-end sm:self-start text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
                {docList.map(item => {
                  const doc = selectedFileForDocs.documents?.[item.key] || (item.alias ? selectedFileForDocs.documents?.[item.alias] : null);
                  const attachedFiles = normalizeDocList(doc);
                  const isUploaded = attachedFiles.length > 0;

                  return (
                    <div
                      key={item.key}
                      className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between transition-all ${isUploaded ? 'bg-emerald-50/50 border-emerald-300 shadow-xs' : 'bg-slate-50/80 border-slate-200 border-dashed hover:border-slate-300'
                        }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                              {item.icon || 'description'}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{item.label}</h4>
                              <p className="text-[11px] text-slate-500 leading-tight">{item.category} &bull; {item.description}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${isUploaded
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.mandatory
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                            {isUploaded ? (attachedFiles.length > 1 ? `${attachedFiles.length} Attached` : 'Uploaded') : (item.mandatory ? 'Pending' : 'Optional')}
                          </span>
                        </div>

                        {/* LIST OF ATTACHED DOCUMENTS WITH INDIVIDUAL PREVIEW & REMOVE */}
                        {isUploaded && (
                          <div className="space-y-1.5 pt-1">
                            {attachedFiles.map((fileItem, fIdx) => (
                              <div
                                key={fileItem.id || fileItem.url || fIdx}
                                className="p-2 bg-white rounded-lg border border-emerald-200 text-xs flex items-center justify-between gap-2 hover:border-emerald-400 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="material-symbols-outlined text-emerald-700 text-[16px] shrink-0">
                                    {fileItem.filename?.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono text-emerald-900 font-semibold truncate text-[11px]" title={fileItem.filename}>
                                      {fileItem.filename}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-sans flex items-center gap-2 mt-0.5">
                                      <span>{fileItem.size || 'Optimized'}</span>
                                      <span>&bull;</span>
                                      <span>{fileItem.date || 'Today'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc({ ...item, ...fileItem, title: `${item.label} (${fileItem.filename})` })}
                                    className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                                    title="View Preview"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDoc(selectedFileForDocs.id, item.key, fileItem.id || fileItem.url || fileItem.filename)}
                                    className="p-1 rounded-md text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                                    title="Remove this document"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons (Add file / Camera) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center gap-2 text-xs">
                        {isUploaded ? (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => setCameraTargetDoc(item)}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-emerald-200 shadow-2xs"
                              title="Upload another photo or PDF"
                            >
                              <span className="material-symbols-outlined text-[16px]">add_circle</span>
                              <span>Add More Media / PDF</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => setCameraTargetDoc(item)}
                              className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-200 hover:border-slate-300 shadow-2xs"
                              title="Upload photos or PDF document"
                            >
                              <span className="material-symbols-outlined text-[16px] text-emerald-600">upload_file</span>
                              <span>Upload Document / Media {item.mandatory ? '' : '(Optional)'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#E4E7EB]">
                <button
                  type="button"
                  onClick={() => setSelectedFileForDocs(null)}
                  className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  Close Vault
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RICH DOCUMENT PREVIEW & INSPECTION MODAL */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* CUSTOMER FILE TIMELINE MODAL */}
      {selectedFileForTimeline && (
        <CustomerFileDetailModal
          file={selectedFileForTimeline}
          onClose={() => setSelectedFileForTimeline(null)}
        />
      )}

      {/* SOLAR BANK SELECTION MODAL */}
      <SolarBankSelectorModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        selectedBank={newCustLoanBank}
        onSelectBank={(bankName) => {
          setNewCustLoanBank(bankName);
          setShowBankModal(false);
          addToast(`Selected bank: ${bankName}`, 'success');
        }}
      />

      {/* CAMERA CAPTURE MODAL */}
      {cameraTargetDoc && (
        <CameraCaptureModal
          isOpen={Boolean(cameraTargetDoc)}
          docKey={cameraTargetDoc.key}
          docLabel={cameraTargetDoc.label}
          documentLabel={cameraTargetDoc.label}
          onCapture={handleCameraCapture}
          onClose={() => setCameraTargetDoc(null)}
          isUploading={cameraIsUploading}
          uploadProgress={cameraUploadProgress}
          maxPhotos={5}
        />
      )}

      {/* EDIT CUSTOMER FILE MODAL */}
      {fileToEdit && (
        <EditCustomerFileModal
          file={fileToEdit}
          isOpen={Boolean(fileToEdit)}
          onClose={() => setFileToEdit(null)}
          onSave={async (fileId, updatedFields) => {
            await editCustomerFile(fileId, updatedFields);
          }}
        />
      )}

      {/* CANCEL / DELETE CUSTOMER FILE MODAL */}
      {fileToCancel && (
        <CancelCustomerFileModal
          file={fileToCancel}
          isOpen={Boolean(fileToCancel)}
          isAdmin={true}
          initialDeleteMode={fileToCancel.status === 'Cancelled' ? 'hard_delete' : 'soft_cancel'}
          onClose={() => setFileToCancel(null)}
          onCancelFile={async (fileId, reason) => {
            await cancelCustomerFile(fileId, reason);
          }}
          onHardDelete={async (fileId) => {
            await deleteCustomerFile(fileId);
          }}
        />
      )}
    </div>
  );
}
