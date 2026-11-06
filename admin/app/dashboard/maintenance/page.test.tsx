import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MaintenancePage from './page';
import { apiFetch } from '@/lib/api';
jest.mock('@/lib/api',()=>({apiFetch:jest.fn()}));
const mock=apiFetch as jest.Mock;
const costs={label:'Estimate, not provider balance',month:'2026-11',estimated_usd:0,budget_usd:10,opening_spend_verified:false,alert:true,stopped:true,runs:[],coverage:'Local only'};
beforeEach(()=>{mock.mockReset();mock.mockImplementation((url:string)=>Promise.resolve(url.endsWith('/costs')?costs:{operations:[]}));});
it('shows estimates as estimates and blocks confirmation without preview',async()=>{
 render(<MaintenancePage/>);await screen.findByText(/Opening spend is unverified/);
 expect(screen.queryByText('Confirm reviewed change')).not.toBeInTheDocument();
 expect(screen.getByText('Preview merge')).toBeDisabled();
});
it('renders identity warning and prevents merge confirmation',async()=>{
 render(<MaintenancePage/>);await screen.findByText(/Opening spend is unverified/);
 fireEvent.change(screen.getByLabelText('Keep restaurant ID'),{target:{value:'keep'}});
 fireEvent.change(screen.getByLabelText('Duplicate restaurant ID'),{target:{value:'drop'}});
 mock.mockResolvedValueOnce({revision:'abc',warnings:['Conflicting google_place_id']});
 fireEvent.click(screen.getByText('Preview merge'));
 await waitFor(()=>expect(screen.getByText('Confirm reviewed change')).toBeDisabled());
});
it('discards preview when IDs change',async()=>{
 render(<MaintenancePage/>);await screen.findByText(/Opening spend is unverified/);
 fireEvent.change(screen.getByLabelText('Keep restaurant ID'),{target:{value:'keep'}});
 fireEvent.change(screen.getByLabelText('Duplicate restaurant ID'),{target:{value:'drop'}});
 mock.mockResolvedValueOnce({revision:'abc',warnings:[]});fireEvent.click(screen.getByText('Preview merge'));
 await screen.findByText('Confirm reviewed change');
 fireEvent.change(screen.getByLabelText('Duplicate restaurant ID'),{target:{value:'other'}});
 expect(screen.queryByText('Confirm reviewed change')).not.toBeInTheDocument();
});
