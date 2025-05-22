// Create this file as: genbase/app/api/providers/[namespace]/[name]/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Helper function to fetch and convert image to base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'GenBase-App/1.0',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch image from ${imageUrl}: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    
    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching image from ${imageUrl}:`, error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { namespace: string; name: string } }
) {
  const { namespace, name } = await params;

  try {
    // Validate input parameters
    if (!namespace || !name) {
      return NextResponse.json(
        { error: 'Namespace and name are required' },
        { status: 400 }
      );
    }

    // Fetch from Terraform Registry API
    const response = await fetch(
      `https://registry.terraform.io/v1/providers/${namespace}/${name}`,
      {
        headers: {
          'User-Agent': 'GenBase-App/1.0',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Prepare response data
    const providerData = {
      id: data.id,
      owner: data.owner,
      namespace: data.namespace,
      name: data.name,
      logo_url: data.logo_url,
      description: data.description,
      source: data.source,
      published_at: data.published_at,
      downloads: data.downloads,
      tier: data.tier,
      logo_data: null as string | null,
    };

    // If there's a logo URL, fetch the actual image data
    if (data.logo_url) {
      const logoUrl = data.logo_url.startsWith('http') 
        ? data.logo_url 
        : `https://registry.terraform.io${data.logo_url}`;
      
      const logoData = await fetchImageAsBase64(logoUrl);
      if (logoData) {
        providerData.logo_data = logoData;
      }
    }

    // Return the provider data with logo as base64
    return NextResponse.json({
      success: true,
      data: providerData
    });

  } catch (error) {
    console.error(`Error fetching provider ${namespace}/${name}:`, error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch provider information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}