import React, { useState } from 'react';

interface ZOnlineRequest {
    requestor: string;
    password: string;
    requestType: '1' | '2' | '3'; // 1: Haftpflicht, 2: Kasko, 3: Schutzbrief
    dateOfLoss: string;
    licenceNumber: string;
    country: string;
    admissionOfficeRequestDesired: '0' | '1';
}

interface ZOnlineResponse {
    responseCode: string;
    manufacturerName?: string;
    typeName?: string;
    insuranceCompanyName?: string;
    insurancePOName?: string;
    insurancePOTelephoneNo?: string;
    errorMessage?: string;
}

const ZOnlineApi: React.FC = () => {
    const [formData, setFormData] = useState<ZOnlineRequest>({
        requestor: import.meta.env.VITE_ZONLINE_REQUESTOR || 'ZA0315P03012714',
        password: import.meta.env.VITE_ZONLINE_PASSWORD || 'F08H93A063C',
        requestType: '1',
        dateOfLoss: new Date().toISOString().split('T')[0],
        licenceNumber: '',
        country: 'D',
        admissionOfficeRequestDesired: '0'
    });

    const [response, setResponse] = useState<ZOnlineResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const generateXML = (data: ZOnlineRequest): string => {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <Requestor>${data.requestor}</Requestor>
  <Password>${data.password}</Password>
  <RequestType>${data.requestType}</RequestType>
  <DateOfLoss>${data.dateOfLoss}</DateOfLoss>
  <LicenceNumber>${data.licenceNumber}</LicenceNumber>
  <Country>${data.country}</Country>
  <AdmissionOfficeRequestDesired>${data.admissionOfficeRequestDesired}</AdmissionOfficeRequestDesired>
</Request>`;
    };

    const handleSubmit = async () => {
        setLoading(true);
        setResponse(null);

        try {
            const xmlRequest = generateXML(formData);
            console.log('Generated XML:', xmlRequest);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/zonline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/xml' },
                body: xmlRequest
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const responseText = await response.text();
            console.log('Response XML:', responseText);
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(responseText, 'text/xml');

            setResponse({
                responseCode: xmlDoc.getElementsByTagName('ResponseCode')[0]?.textContent || '-1',
                manufacturerName: xmlDoc.getElementsByTagName('ManufacturerName')[0]?.textContent || '',
                typeName: xmlDoc.getElementsByTagName('TypeName')[0]?.textContent || '',
                insuranceCompanyName: xmlDoc.getElementsByTagName('InsuranceCompanyName')[0]?.textContent || '',
                insurancePOTelephoneNo: xmlDoc.getElementsByTagName('InsurancePOTelephoneNo')[0]?.textContent || ''
            });

        } catch (error: any) {
            setResponse({
                responseCode: '-1',
                errorMessage: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Z@Online API</h2>

            <div className="space-y-4 mb-6">
                <input
                    type="text"
                    placeholder="Benutzername"
                    value={formData.requestor}
                    onChange={(e) => setFormData({ ...formData, requestor: e.target.value })}
                    className="w-full p-2 border rounded"
                />

                <input
                    type="password"
                    placeholder="Passwort"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full p-2 border rounded"
                />

                <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value as '1' | '2' | '3' })}
                    className="w-full p-2 border rounded"
                >
                    <option value="1">Haftpflicht</option>
                    <option value="2">Kasko</option>
                    <option value="3">Schutzbrief</option>
                </select>

                <input
                    type="date"
                    value={formData.dateOfLoss}
                    onChange={(e) => setFormData({ ...formData, dateOfLoss: e.target.value })}
                    className="w-full p-2 border rounded"
                />

                <input
                    type="text"
                    placeholder="Kennzeichen (z.B. M AB 1234)"
                    value={formData.licenceNumber}
                    onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value })}
                    className="w-full p-2 border rounded"
                />

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {loading ? 'Sende...' : 'Anfrage senden'}
                </button>
            </div>

            {response && (
                <div className="bg-gray-100 p-4 rounded">
                    <h3 className="font-bold mb-2">Antwort:</h3>
                    <p>Status Code: {response.responseCode}</p>
                    {response.manufacturerName && <p>Hersteller: {response.manufacturerName}</p>}
                    {response.typeName && <p>Typ: {response.typeName}</p>}
                    {response.insuranceCompanyName && <p>Versicherung: {response.insuranceCompanyName}</p>}
                    {response.insurancePOTelephoneNo && <p>Telefon: {response.insurancePOTelephoneNo}</p>}
                    {response.errorMessage && <p className="text-red-500">Fehler: {response.errorMessage}</p>}
                </div>
            )}
        </div>
    );
};

export default ZOnlineApi;