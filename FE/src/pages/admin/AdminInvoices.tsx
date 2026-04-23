import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Download, Search, Eye, 
  Calendar, DollarSign, Printer, Building2,
  CheckCircle2, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { statsApi, type Invoice } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';

export const AdminInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ start: '', end: '' });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await statsApi.getInvoices({
        start_date: filter.start,
        end_date: filter.end
      });
      if (res.success) {
        setInvoices(res.data.invoices);
        setTotalRevenue(res.data.totalRevenue);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const getGatewayLabel = (gateway: string) => {
    switch (gateway.toUpperCase()) {
      case 'VNPAY': return 'Ví VNPay';
      case 'CASH':  return 'Tiền mặt';
      case 'MOMO':  return 'Ví MoMo';
      default:      return gateway;
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" />
            Quản lý hóa đơn
          </h1>
          <p className="text-sm text-gray-500">Đối soát doanh thu và xem lịch sử giao dịch thực tế.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <input 
                type="date" 
                value={filter.start}
                onChange={e => setFilter(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs px-2 py-1.5 outline-none border-none focus:ring-0"
              />
              <span className="text-gray-400">→</span>
              <input 
                type="date" 
                value={filter.end}
                onChange={e => setFilter(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs px-2 py-1.5 outline-none border-none focus:ring-0"
              />
           </div>
           <button 
             onClick={load}
             className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2"
           >
             <Search size={16} /> Lọc
           </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-lg overflow-hidden relative group">
           <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <DollarSign size={120} />
           </div>
           <div className="relative z-10">
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Doanh thu thực tế kỳ này</p>
              <h3 className="text-3xl font-black mt-1">{formatVND(totalRevenue)}</h3>
              <div className="mt-4 flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20">
                 <CheckCircle2 size={12} />
                 Chỉ tính các giao dịch thành công
              </div>
           </div>
        </Card>
        
        <div className="md:col-span-2 flex items-center justify-end">
           <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-bold px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm transition-all hover:shadow-md">
              <Download size={16} /> Xuất báo cáo kế toán
           </button>
        </div>
      </div>

      {/* Invoice Table */}
      <Card padding={false} className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Mã Booking</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Ngày thanh toán</th>
                <th className="px-6 py-4">Phương thức</th>
                <th className="px-6 py-4">Số tiền</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length > 0 ? invoices.map((inv) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={inv.payment_id} 
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <span className="text-xs font-black text-gray-900 bg-gray-100 px-2 py-1 rounded">#{inv.booking_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{inv.full_name || 'Khách vãng lai'}</p>
                    <p className="text-[10px] text-gray-400">{inv.email || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    {formatDate(inv.transaction_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className={inv.gateway === 'VNPAY' ? 'text-blue-500' : 'text-emerald-500'} />
                      <span className="text-xs font-medium text-gray-700">
                        {getGatewayLabel(inv.gateway)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-emerald-600">{formatVND(inv.amount)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-2 rounded-lg bg-white border border-gray-100 shadow-sm text-gray-400 hover:text-blue-600 hover:border-blue-100 transition-all active:scale-90"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </motion.tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400 text-sm italic">
                    {loading ? 'Đang tải dữ liệu...' : 'Không tìm thấy hóa đơn nào trong khoảng này.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10 print:shadow-none print:rounded-none"
            >
              {/* Modal Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-2 print:hidden">
                <button 
                  onClick={handlePrint}
                  className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
                >
                  <Printer size={18} />
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
                >
                  <Eye size={18} className="rotate-180" />
                </button>
              </div>

              {/* Receipt Content */}
              <div className="p-10 space-y-8" id="printable-invoice">
                {/* Logo & Hotel Info */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl">
                       <Building2 className="text-white" size={24} />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase">SmartHotel</h2>
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Premium Living</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-black text-gray-900">HÓA ĐƠN THANH TOÁN</h3>
                    <p className="text-xs text-gray-500">Mã: INV-{selectedInvoice.payment_id}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(selectedInvoice.transaction_date)}</p>
                  </div>
                </div>

                {/* Customer & Transaction Info */}
                <div className="grid grid-cols-2 gap-10">
                   <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Khách hàng</h4>
                      <p className="text-sm font-bold text-gray-900">{selectedInvoice.full_name || 'Khách vãng lai'}</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedInvoice.email || 'No email'}</p>
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Chi tiết giao dịch</h4>
                      <p className="text-xs text-gray-600">Mã Booking: <span className="font-bold text-gray-900">#{selectedInvoice.booking_id}</span></p>
                      <p className="text-xs text-gray-600 mt-1">Phương thức: <span className="font-bold text-gray-900">{getGatewayLabel(selectedInvoice.gateway)}</span></p>
                      {selectedInvoice.trans_id && (
                        <p className="text-[10px] text-gray-400 mt-1 break-all">Mã GD: {selectedInvoice.trans_id}</p>
                      )}
                   </div>
                </div>

                {/* Bill Table */}
                <div className="bg-gray-50 rounded-2xl p-6">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-gray-500">Nội dung thanh toán</span>
                      <span className="text-xs font-bold text-gray-500">Số tiền</span>
                   </div>
                   <div className="space-y-3 pt-4 border-t border-gray-200/50">
                      <div className="flex justify-between items-center">
                         <span className="text-sm font-medium text-gray-700">Tiền thuê phòng (Trọn gói)</span>
                         <span className="text-sm font-bold text-gray-900">{formatVND(selectedInvoice.booking_total)}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600 pt-2 border-t border-dashed border-gray-300">
                         <span className="text-xs font-bold uppercase tracking-wider">Tổng tiền đã trả</span>
                         <span className="text-lg font-black">{formatVND(selectedInvoice.amount)}</span>
                      </div>
                   </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-8">
                   <div className="inline-flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      Giao dịch đã được xác nhận thành công
                   </div>
                   <p className="text-[10px] text-gray-300 mt-6 italic">Cảm ơn quý khách đã lựa chọn dịch vụ của SmartHotel. Hẹn gặp lại!</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
