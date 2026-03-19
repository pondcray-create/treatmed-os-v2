"use client"

import { useState } from "react"
import { Search, Plus, ChevronRight, Star, Phone, Mail, MapPin, Building2, Users, Pencil, Trash2, X, Building } from "lucide-react"
import { PROVINCES, DEFAULT_ORG_TYPES, DEFAULT_ORG_FORMATS, DEFAULT_POSITIONS, getProvinceInfo } from "@/lib/data/geography"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Contact {
  id: string
  name: string
  position: string
  email: string
  tel: string
  is_primary: boolean
}

interface Organization {
  id: string
  name: string
  org_type: string
  org_format: string
  province: string
  region: string
  health_district: number
  one_qa: boolean
  contacts: Contact[]
  created_at: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ORGS: Organization[] = [
  {
    id: "1", name: "โรงพยาบาลศิริราช", org_type: "Existing", org_format: "Large Hospital รัฐ",
    province: "กรุงเทพมหานคร", region: "กลาง", health_district: 13, one_qa: true,
    created_at: "2024-01-15",
    contacts: [
      { id: "c1", name: "นพ.วีระชัย สมิทธ์", position: "แพทย์", email: "weerachai@siriraj.ac.th", tel: "02-419-7000", is_primary: true },
      { id: "c2", name: "นางสาวพรรณี วงศ์ดี", position: "ฝ่ายจัดซื้อ", email: "pannee@siriraj.ac.th", tel: "02-419-7001", is_primary: false },
    ]
  },
  {
    id: "2", name: "โรงพยาบาลกรุงเทพ", org_type: "Existing", org_format: "Large Hospital เอกชน",
    province: "กรุงเทพมหานคร", region: "กลาง", health_district: 13, one_qa: false,
    created_at: "2024-02-20",
    contacts: [
      { id: "c3", name: "นายประสิทธิ์ แก้วมณี", position: "วิศวกรชีวการแพทย์", email: "prasit@bgh.co.th", tel: "02-310-3000", is_primary: true },
    ]
  },
  {
    id: "3", name: "โรงพยาบาลมหาราชนครเชียงใหม่", org_type: "Existing", org_format: "Large Hospital รัฐ",
    province: "เชียงใหม่", region: "เหนือ", health_district: 1, one_qa: true,
    created_at: "2024-03-10",
    contacts: [
      { id: "c4", name: "นางสมศรี ใจดี", position: "ฝ่ายจัดซื้อ", email: "somsri@cmu.ac.th", tel: "053-935-000", is_primary: true },
      { id: "c5", name: "นายวิทยา คงดี", position: "เจ้าหน้าที่ไอที", email: "wittaya@cmu.ac.th", tel: "053-935-001", is_primary: false },
    ]
  },
  {
    id: "4", name: "โรงพยาบาลขอนแก่น", org_type: "New", org_format: "Large Hospital รัฐ",
    province: "ขอนแก่น", region: "อีสาน", health_district: 7, one_qa: false,
    created_at: "2024-06-01",
    contacts: [
      { id: "c6", name: "นพ.ธีรพล รักดี", position: "ผู้บริหาร", email: "theerapol@kkh.go.th", tel: "043-232-555", is_primary: true },
    ]
  },
]

// ─── Badge ────────────────────────────────────────────────────────────────────
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{children}</span>
}

// ─── Org Card ─────────────────────────────────────────────────────────────────
function OrgCard({ org, selected, onClick }: { org: Organization; selected: boolean; onClick: () => void }) {
  const primary = org.contacts.find(c => c.is_primary)
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border transition-all ${selected ? "bg-blue-50 border-blue-300 shadow-sm" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="font-semibold text-sm text-gray-900 truncate">{org.name}</p>
            {org.one_qa && <span className="shrink-0 text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-medium">One-QA</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Pill color={org.org_type === "New" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}>{org.org_type}</Pill>
            <span className="text-xs text-gray-400 truncate">{org.org_format}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{org.province} · เขต {org.health_district}</span>
          </div>
          {primary && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">{primary.name}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-400">{org.contacts.length} คน</span>
          <ChevronRight className={`h-4 w-4 ${selected ? "text-blue-400" : "text-gray-300"}`} />
        </div>
      </div>
    </button>
  )
}

// ─── Contact Row ──────────────────────────────────────────────────────────────
function ContactRow({ contact, onSetPrimary, onEdit, onDelete }: {
  contact: Contact; onSetPrimary: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${contact.is_primary ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
      <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${contact.is_primary ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>
        {contact.name.replace(/^(นพ\.|นาง|นาย|น\.ส\.|นส\.)\s*/, "").charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm text-gray-900">{contact.name}</p>
          {contact.is_primary && (
            <span className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
              <Star className="h-2.5 w-2.5 fill-blue-500 text-blue-500" /> หลัก
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{contact.position}</p>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {contact.tel && (
            <a href={`tel:${contact.tel}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors">
              <Phone className="h-3 w-3" />{contact.tel}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors">
              <Mail className="h-3 w-3" />{contact.email}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!contact.is_primary && (
          <button onClick={onSetPrimary} title="ตั้งเป็นผู้ติดต่อหลัก" className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors">
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Org Dialog ───────────────────────────────────────────────────────────────
function OrgDialog({ org, onClose, onSave }: { org: Partial<Organization> | null; onClose: () => void; onSave: (d: Partial<Organization>) => void }) {
  const [form, setForm] = useState({ name: org?.name ?? "", org_type: org?.org_type ?? "New", org_format: org?.org_format ?? "", province: org?.province ?? "", one_qa: org?.one_qa ?? false })
  const info = getProvinceInfo(form.province)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ ...org, ...form, region: info?.region ?? "", health_district: info?.healthDistrict ?? 0 })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg">{org?.id ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงานใหม่"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อหน่วยงาน *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="ชื่อโรงพยาบาล / คลินิก" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภท</label>
              <select value={form.org_type} onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                {DEFAULT_ORG_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รูปแบบ</label>
              <select value={form.org_format} onChange={e => setForm(f => ({ ...f, org_format: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                <option value="">-- เลือก --</option>
                {DEFAULT_ORG_FORMATS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">จังหวัด</label>
            <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
              <option value="">-- เลือกจังหวัด --</option>
              {PROVINCES.map(p => <option key={p.name}>{p.name}</option>)}
            </select>
            {info && (
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">ภาค{info.region}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">เขตสุขภาพที่ {info.healthDistrict}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setForm(f => ({ ...f, one_qa: !f.one_qa }))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.one_qa ? "bg-violet-50 border-violet-300" : "bg-gray-50 border-gray-200"}`}>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.one_qa ? "bg-violet-500" : "bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.one_qa ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${form.one_qa ? "text-violet-800" : "text-gray-700"}`}>ใช้งาน One-QA</p>
              <p className={`text-xs ${form.one_qa ? "text-violet-600" : "text-gray-400"}`}>บันทึกการใช้ Software ของ TreatMed</p>
            </div>
          </button>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600">{org?.id ? "บันทึก" : "เพิ่มหน่วยงาน"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Contact Dialog ───────────────────────────────────────────────────────────
function ContactDialog({ contact, onClose, onSave }: { contact: Partial<Contact> | null; onClose: () => void; onSave: (d: Partial<Contact>) => void }) {
  const [form, setForm] = useState({ name: contact?.name ?? "", position: contact?.position ?? "", email: contact?.email ?? "", tel: contact?.tel ?? "", is_primary: contact?.is_primary ?? false })
  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ ...contact, ...form })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg">{contact?.id ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อ"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ-นามสกุล *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="ชื่อผู้ติดต่อ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ตำแหน่ง</label>
            <div className="flex gap-2">
              <select value={DEFAULT_POSITIONS.includes(form.position) ? form.position : ""}
                onChange={e => { if (e.target.value) setForm(f => ({ ...f, position: e.target.value })) }}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                <option value="">เลือก...</option>
                {DEFAULT_POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
              <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="หรือพิมพ์เอง" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">เบอร์โทร</label>
              <input value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0xx-xxx-xxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="email@example.com" />
            </div>
          </div>
          <button type="button" onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${form.is_primary ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${form.is_primary ? "bg-blue-500" : "bg-gray-300"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_primary ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${form.is_primary ? "text-blue-800" : "text-gray-700"}`}>ผู้ติดต่อหลัก</p>
              <p className={`text-xs ${form.is_primary ? "text-blue-500" : "text-gray-400"}`}>แสดงชื่อในรายการหลักขององค์กร</p>
            </div>
          </button>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600">{contact?.id ? "บันทึก" : "เพิ่มผู้ติดต่อ"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [orgs, setOrgs] = useState<Organization[]>(MOCK_ORGS)
  const [selected, setSelected] = useState<Organization | null>(MOCK_ORGS[0])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("ทั้งหมด")
  const [filterRegion, setFilterRegion] = useState("ทั้งหมด")
  const [orgDialog, setOrgDialog] = useState<{ open: boolean; data: Partial<Organization> | null }>({ open: false, data: null })
  const [contactDialog, setContactDialog] = useState<{ open: boolean; data: Partial<Contact> | null }>({ open: false, data: null })

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase()
    return (o.name.toLowerCase().includes(q) || o.contacts.some(c => c.name.toLowerCase().includes(q))) &&
      (filterType === "ทั้งหมด" || o.org_type === filterType) &&
      (filterRegion === "ทั้งหมด" || o.region === filterRegion)
  })

  function saveOrg(data: Partial<Organization>) {
    if (data.id) {
      setOrgs(prev => prev.map(o => o.id === data.id ? { ...o, ...data } : o))
      setSelected(s => s?.id === data.id ? { ...s, ...data } : s)
    } else {
      const n: Organization = { id: Date.now().toString(), contacts: [], created_at: new Date().toISOString(), name: data.name ?? "", org_type: data.org_type ?? "New", org_format: data.org_format ?? "", province: data.province ?? "", region: data.region ?? "", health_district: data.health_district ?? 0, one_qa: data.one_qa ?? false }
      setOrgs(prev => [...prev, n])
    }
  }

  function saveContact(data: Partial<Contact>) {
    if (!selected) return
    let contacts: Contact[]
    if (data.id) {
      contacts = selected.contacts.map(c => c.id === data.id ? { ...c, ...data } as Contact : c)
    } else {
      const n: Contact = { id: Date.now().toString(), name: data.name ?? "", position: data.position ?? "", email: data.email ?? "", tel: data.tel ?? "", is_primary: data.is_primary ?? false }
      contacts = data.is_primary ? [...selected.contacts.map(c => ({ ...c, is_primary: false })), n] : [...selected.contacts, n]
    }
    const updated = { ...selected, contacts }
    setOrgs(prev => prev.map(o => o.id === selected.id ? updated : o))
    setSelected(updated)
  }

  function setPrimary(cid: string) {
    if (!selected) return
    const updated = { ...selected, contacts: selected.contacts.map(c => ({ ...c, is_primary: c.id === cid })) }
    setOrgs(prev => prev.map(o => o.id === selected.id ? updated : o))
    setSelected(updated)
  }

  function deleteContact(cid: string) {
    if (!selected) return
    const updated = { ...selected, contacts: selected.contacts.filter(c => c.id !== cid) }
    setOrgs(prev => prev.map(o => o.id === selected.id ? updated : o))
    setSelected(updated)
  }

  const selInfo = selected ? getProvinceInfo(selected.province) : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ทะเบียนลูกค้า</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orgs.length} หน่วยงาน · {orgs.reduce((a, o) => a + o.contacts.length, 0)} ผู้ติดต่อ</p>
        </div>
        <button onClick={() => setOrgDialog({ open: true, data: {} })}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> เพิ่มหน่วยงาน
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left — List */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              placeholder="ค้นหาหน่วยงาน / ผู้ติดต่อ" />
          </div>
          <div className="flex gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {["ทั้งหมด", "Existing", "New"].map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {["ทั้งหมด", "เหนือ", "กลาง", "อีสาน", "ตะวันออก", "ใต้"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">ไม่พบหน่วยงาน</p>
              : filtered.map(o => <OrgCard key={o.id} org={o} selected={selected?.id === o.id} onClick={() => setSelected(o)} />)
            }
          </div>
        </div>

        {/* Right — Detail */}
        {selected ? (
          <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
            {/* Org Info */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Pill color={selected.org_type === "New" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}>{selected.org_type}</Pill>
                      <Pill color="bg-gray-100 text-gray-600">{selected.org_format}</Pill>
                      {selected.one_qa && <Pill color="bg-violet-50 text-violet-700 border border-violet-200">One-QA ✓</Pill>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setOrgDialog({ open: true, data: selected })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                  <Pencil className="h-3 w-3" /> แก้ไข
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">จังหวัด</p>
                  <p className="text-sm font-bold text-gray-900">{selected.province || "—"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">ภูมิภาค</p>
                  <p className="text-sm font-bold text-gray-900">{selInfo?.region ? `ภาค${selInfo.region}` : "—"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">เขตสุขภาพ</p>
                  <p className="text-sm font-bold text-gray-900">{selected.health_district ? `เขต ${selected.health_district}` : "—"}</p>
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <h3 className="font-bold text-gray-900">ผู้ติดต่อ</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{selected.contacts.length} คน</span>
                </div>
                <button onClick={() => setContactDialog({ open: true, data: {} })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors">
                  <Plus className="h-3 w-3" /> เพิ่ม
                </button>
              </div>
              {selected.contacts.length === 0
                ? <div className="text-center py-10 text-gray-400"><Users className="h-10 w-10 mx-auto mb-2 opacity-20" /><p className="text-sm">ยังไม่มีผู้ติดต่อ</p></div>
                : <div className="space-y-2">
                    {[...selected.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(c => (
                      <ContactRow key={c.id} contact={c} onSetPrimary={() => setPrimary(c.id)} onEdit={() => setContactDialog({ open: true, data: c })} onDelete={() => deleteContact(c.id)} />
                    ))}
                  </div>
              }
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">งานซ่อม / สอบเทียบ</p>
                <p className="text-3xl font-black text-gray-200">—</p>
                <p className="text-xs text-gray-400 mt-1">เชื่อมข้อมูลจาก Service Jobs</p>
              </div>
              <div className="bg-white rounded-3xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-2">ซื้อซ้ำ / ดีล</p>
                <p className="text-3xl font-black text-gray-200">—</p>
                <p className="text-xs text-gray-400 mt-1">เชื่อมข้อมูลจาก SE Deals</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center"><Building className="h-16 w-16 mx-auto mb-3 opacity-20" /><p className="text-sm">เลือกหน่วยงานเพื่อดูรายละเอียด</p></div>
          </div>
        )}
      </div>

      {orgDialog.open && <OrgDialog org={orgDialog.data} onClose={() => setOrgDialog({ open: false, data: null })} onSave={saveOrg} />}
      {contactDialog.open && <ContactDialog contact={contactDialog.data} onClose={() => setContactDialog({ open: false, data: null })} onSave={saveContact} />}
    </div>
  )
}
