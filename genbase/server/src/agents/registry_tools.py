"""
Optimized Terraform Registry Tools for LLM consumption.
Returns concise, structured data focused on actionable information.
"""
import os
import requests
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin
import json
import sys
from ..logger import logger


class RegistryTools:
    """
    Tools for interacting with the Terraform Registry API.
    Optimized for LLM consumption with concise, structured outputs.
    """
    
    BASE_URL_V1 = "https://registry.terraform.io/v1/modules/"
    BASE_URL_V2 = "https://registry.terraform.io/v2/modules/"
    
    def __init__(self, project_id: str, branch: str):
        """
        Initialize the TerraformRegistryTools
        
        Args:
            project_id: The project identifier
            branch: The branch (for consistency with other tools)
        """
        self.project_id = project_id
        self.branch = branch
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Genbase-Agent/1.0',
            'Accept': 'application/json'
        })
    
    async def registry_list_modules(
        self,
        namespace: Optional[str] = None,
        provider: Optional[str] = None,
        verified: Optional[bool] = None,
        limit: int = 10,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List modules from the Terraform Registry.
        
        Returns a concise list of modules with essential information only.
        Useful for browsing available modules by namespace or provider.
        
        Args:
            namespace: Filter by namespace/organization (e.g., "hashicorp")
            provider: Filter by provider (e.g., "aws", "google", "azure")
            verified: If True, only return verified/partner modules
            limit: Maximum results (default: 10, max: 50)
            offset: Pagination offset
            
        Returns:
            Dict with success status, module list, and pagination info
            
        Example:
            registry_list_modules(namespace="hashicorp", provider="aws", verified=True)
        """
        try:
            # Build URL
            if namespace:
                url = urljoin(self.BASE_URL_V1, namespace)
            else:
                # remove /
                url = self.BASE_URL_V1.rstrip('/')
            
            # Build query parameters
            params: Dict[str, Any] = {
                'limit': min(limit, 50),  # Cap at 50 for LLM context
                'offset': max(offset, 0)
            }
            
            if provider:
                params['provider'] = provider
            if verified is not None:
                params['verified'] = str(verified).lower()
            
            # Make request
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            modules = data.get("modules", [])
            
            # Process modules into concise format
            processed_modules = []
            for module in modules:
                processed_modules.append({
                    "address": f"{module.get('namespace', '')}/{module.get('name', '')}/{module.get('provider', '')}",
                    "latest_version": module.get("version", ""),
                    "description": module.get("description", "")[:100] + "..." if len(module.get("description", "")) > 100 else module.get("description", ""),
                    "downloads": module.get("downloads", 0),
                    "verified": module.get("verified", False),
                    "last_updated": module.get("published_at", "")[:10]  # Just the date part
                })
            
            # Check if more results available
            meta = data.get("meta", {})
            next_offset = meta.get("next_offset")
            
            return {
                "success": True,
                "operation": "list_modules",
                "message": f"Found {len(processed_modules)} modules",
                "total_found": len(modules),
                "showing": len(processed_modules),
                "modules": processed_modules,
                "next_page_available": next_offset is not None
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error listing modules: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to connect to Terraform Registry: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing registry response: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def registry_search_modules(
        self,
        query: str,
        provider: Optional[str] = None,
        namespace: Optional[str] = None,
        limit: int = 10,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for modules in the Terraform Registry.
        
        Returns top matching modules based on registry's relevance ranking.
        Useful for finding modules by keywords or functionality.
        
        Args:
            query: Search keywords (e.g., "vpc", "database", "load balancer")
            provider: Filter by provider (e.g., "aws", "google", "azure")
            namespace: Filter by namespace (e.g., "hashicorp")
            limit: Maximum results (default: 10, max: 20)
            offset: Pagination offset
            
        Returns:
            Dict with success status, matching modules, and search metadata
            
        Example:
            registry_search_modules("vpc", provider="aws", verified=True)
        """
        try:
            url = urljoin(self.BASE_URL_V1, "search")
            
            # Build query parameters
            params = {
                'q': query,
                'limit': min(limit, 20),  # Cap at 20 for LLM context
                'offset': max(offset, 0)
            }
            
            if provider:
                params['provider'] = provider
            if namespace:
                params['namespace'] = namespace

            # Make request
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            modules = data.get("modules", [])
            
            # Process modules into concise format
            processed_modules = []
            for module in modules:
                processed_modules.append({
                    "address": f"{module.get('namespace', '')}/{module.get('name', '')}/{module.get('provider', '')}",
                    "latest_version": module.get("version", ""),
                    "description": module.get("description", "")[:100] + "..." if len(module.get("description", "")) > 100 else module.get("description", ""),
                    "downloads": module.get("downloads", 0),
                    "verified": module.get("verified", False)
                })
            
            # Check if more results available
            meta = data.get("meta", {})
            next_offset = meta.get("next_offset")
            
            return {
                "success": True,
                "operation": "search_modules",
                "message": f"Found {len(processed_modules)} modules matching search",
                "total_matches": len(modules),
                "showing": len(processed_modules),
                "modules": processed_modules,
                "next_page_available": next_offset is not None
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching modules: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to search Terraform Registry: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing search response: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def registry_get_module_versions(
        self,
        namespace: str,
        name: str,
        provider: str,
    ) -> Dict[str, Any]:
        """
        Get available versions for a specific module.
        
        Returns version information for compatibility checking and selection.
        Shows recent versions only to avoid overwhelming output.
        
        Args:
            namespace: Module namespace/owner (e.g., "hashicorp")
            name: Module name (e.g., "consul")
            provider: Provider name (e.g., "aws")
            
        Returns:
            Dict with success status, version list, and compatibility info
            
        Example:
            registry_get_module_versions("hashicorp", "consul", "aws")
        """
        try:
            url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/versions")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            modules = data.get("modules", [])
            
            if not modules:
                return {
                    "success": False,
                    "error": "Module not found in registry"
                }
            
            module_info = modules[0]
            versions_data = module_info.get("versions", [])

            limit_versions = 5
            
            # Process versions - limit to recent ones
            processed_versions = []
            for i, version_info in enumerate(versions_data[:limit_versions]):
                version = version_info.get("version", "")
                processed_versions.append({
                    "version": version,
                    "published": version_info.get("published_at", "")[:10] if version_info.get("published_at") else "",
                    "status": "latest" if i == 0 else "stable"
                })
            
            # Extract compatibility info from latest version
            compatibility = {}
            if versions_data:
                latest_version = versions_data[0]
                root_info = latest_version.get("root", {})
                providers = root_info.get("providers", [])
                
                if providers:
                    compatibility["provider_requirements"] = {}
                    for prov in providers:
                        if prov.get("name") and prov.get("version"):
                            compatibility["provider_requirements"][prov["name"]] = prov["version"]
            
            return {
                "success": True,
                "operation": "get_module_versions",
                "module": f"{namespace}/{name}/{provider}",
                "message": f"Found {len(versions_data)} versions (showing {len(processed_versions)})",
                "total_versions": len(versions_data),
                "latest_version": processed_versions[0]["version"] if processed_versions else None,
                "recent_versions": processed_versions,
                "compatibility": compatibility
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting module versions: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to get module versions: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing versions response: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        
    async def registry_get_module_details(
        self,
        namespace: str,
        name: str,
        provider: str,
        version: Optional[str] = None,
        get_detailed_info: bool = False
    ) -> Dict[str, Any]:
        """
        Get detailed information about a specific module.
        
        Returns structured module information including inputs, outputs, and architecture.
        By default shows summary info; use get_detailed_info=True for comprehensive details.
        
        Args:
            namespace: Module namespace/owner (e.g., "hashicorp")
            name: Module name (e.g., "consul")
            provider: Provider name (e.g., "aws")
            version: Specific version (if None, gets latest)
            get_detailed_info: If True, include full inputs/outputs/resources in compressed text format
            
        Returns:
            Dict with module summary, usage info, and architecture details
            
        Example:
            registry_get_module_details("hashicorp", "consul", "aws")
            registry_get_module_details("hashicorp", "consul", "aws", get_detailed_info=True)
        """
        try:
            if version:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/{version}")
            else:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract basic info
            summary = {
                "description": data.get("description", ""),
                "verified": data.get("verified", False),
                "downloads": data.get("downloads", 0),
                "source": data.get("source", ""),
                "published_at": data.get("published_at", "")[:10] if data.get("published_at") else ""
            }
            
            # Process root module information
            root_module = data.get("root", {})
            inputs = root_module.get("inputs", [])
            outputs = root_module.get("outputs", [])
            submodules = data.get("submodules", [])
            
            # Basic usage info (always included)
            required_inputs = []
            for inp in inputs:
                if not inp.get("default") or inp.get("default") in ["", '""']:
                    required_inputs.append({
                        "name": inp.get("name", ""),
                        "type": inp.get("type", "string"),
                        "description": inp.get("description", "")[:80] + "..." if len(inp.get("description", "")) > 80 else inp.get("description", "")
                    })
            
            key_outputs = [out.get("name", "") for out in outputs[:5]]
            key_submodules = [sub.get("path", "").split("/")[-1] for sub in submodules[:3]]
            
            # Get main resources
            main_resources = []
            for sub in submodules:
                for resource in sub.get("resources", []):
                    res_type = resource.get("type", "")
                    if res_type and res_type not in main_resources:
                        main_resources.append(res_type)
            
            for resource in root_module.get("resources", []):
                res_type = resource.get("type", "")
                if res_type and res_type not in main_resources:
                    main_resources.append(res_type)
            
            usage_info = {
                "required_inputs": required_inputs,
                "optional_inputs_count": len(inputs) - len(required_inputs),
                "outputs_count": len(outputs),
                "key_outputs": key_outputs
            }
            
            architecture_info = {
                "submodules_count": len(submodules),
                "key_submodules": key_submodules,
                "main_resources": main_resources[:8]
            }
            
            result = {
                "success": True,
                "operation": "get_module_details",
                "module": f"{namespace}/{name}/{provider}",
                "version": data.get("version"),
                "message": "Module details retrieved",
                "summary": summary,
                "usage": usage_info,
                "architecture": architecture_info
            }
            
            # Add compressed detailed info if requested
            if get_detailed_info:
                detailed_text = self._format_detailed_module_info(data)
                result["detailed_info"] = detailed_text
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting module details: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to get module details: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing module details: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _format_detailed_module_info(self, data: Dict[str, Any]) -> str:
        """Format module data into compressed text format"""
        
        root_module = data.get("root", {})
        inputs = root_module.get("inputs", [])
        outputs = root_module.get("outputs", [])
        submodules = data.get("submodules", [])
        
        lines = []
        
        # Required inputs
        required_inputs = []
        for inp in inputs:
            if not inp.get("default") or inp.get("default") in ["", '""']:
                required_inputs.append(f"{inp.get('name', '')} {inp.get('type', 'string')}")
        
        if required_inputs:
            lines.append("REQUIRED:")
            lines.append(" ".join(required_inputs))
            lines.append("")
        
        # Optional inputs grouped by type
        if inputs:
            optional_inputs = []
            for inp in inputs:
                if inp.get("default") and inp.get("default") not in ["", '""']:
                    optional_inputs.append(inp)
            
            if optional_inputs:
                lines.append(f"OPTIONAL {len(optional_inputs)}:")
                
                # Group by type
                by_type = {}
                for inp in optional_inputs:
                    inp_type = inp.get("type", "string")
                    if inp_type not in by_type:
                        by_type[inp_type] = []
                    
                    name = inp.get("name", "")
                    default = inp.get("default")
                    
                    # Format with default if it's not null/empty
                    if default and default not in ["null", "\"\"", "{}", "[]"]:
                        by_type[inp_type].append(f"{name}={default}")
                    else:
                        by_type[inp_type].append(name)
                
                # Output each type group
                for type_name, items in by_type.items():
                    if items:
                        lines.append(f"{type_name.upper()}: {' '.join(items)}")
                
                lines.append("")
        
        # Outputs
        if outputs:
            output_names = [out.get("name", "") for out in outputs if out.get("name")]
            lines.append(f"OUTPUTS {len(outputs)}:")
            lines.append(" ".join(output_names))
            lines.append("")
        
        # Submodules
        if submodules:
            submodule_names = []
            all_resources = []
            
            for sub in submodules:
                path = sub.get("path", "")
                if path:
                    submodule_names.append(path.split("/")[-1])
                
                # Collect resources from submodules
                for resource in sub.get("resources", []):
                    res_type = resource.get("type", "")
                    if res_type and res_type not in all_resources:
                        all_resources.append(res_type)
            
            lines.append(f"SUBMODULES {len(submodules)}:")
            lines.append(" ".join(submodule_names))
            lines.append("")
            
            # Add root module resources
            for resource in root_module.get("resources", []):
                res_type = resource.get("type", "")
                if res_type and res_type not in all_resources:
                    all_resources.append(res_type)
            
            if all_resources:
                lines.append("RESOURCES:")
                lines.append(" ".join(all_resources))
        
        return "\n".join(lines)
        
    async def registry_get_module_download_info(
        self,
        namespace: str,
        name: str,
        provider: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get download information for a module.
        
        Returns the download URL for module integration/installation.
        Used when you need to actually fetch the module source code.
        
        Args:
            namespace: Module namespace/owner
            name: Module name
            provider: Provider name
            version: Specific version (if None, gets latest)
            
        Returns:
            Dict with download URL and basic info
            
        Example:
            registry_get_module_download_info("hashicorp", "consul", "aws")
        """
        try:
            if version:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/{version}/download")
            else:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/download")
            
            # Don't follow redirects, we want the redirect info
            response = self.session.get(url, allow_redirects=False, timeout=30)
            
            if response.status_code in [204, 302, 307]:
                download_url = response.headers.get('X-Terraform-Get') or response.headers.get('Location')
                
                return {
                    "success": True,
                    "operation": "get_module_download_info",
                    "module": f"{namespace}/{name}/{provider}",
                    "version": version or "latest",
                    "message": "Download URL retrieved",
                    "download_url": download_url
                }
            else:
                response.raise_for_status()
                return {
                    "success": False,
                    "error": f"Unexpected response status: {response.status_code}"
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting download info: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to get download info: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing download info: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def registry_get_module_downloads_summary(
        self,
        namespace: str,
        name: str,
        provider: str
    ) -> Dict[str, Any]:
        """
        Get download metrics for a module.
        
        Returns popularity metrics to help assess module adoption and reliability.
        Higher download counts generally indicate more mature, tested modules.
        
        Args:
            namespace: Module namespace/owner
            name: Module name
            provider: Provider name
            
        Returns:
            Dict with download statistics
            
        Example:
            registry_get_module_downloads_summary("hashicorp", "consul", "aws")
        """
        try:
            url = urljoin(self.BASE_URL_V2, f"{namespace}/{name}/{provider}/downloads/summary")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            attributes = data.get("data", {}).get("attributes", {})
            
            return {
                "success": True,
                "operation": "get_module_downloads_summary",
                "module": f"{namespace}/{name}/{provider}",
                "message": f"{attributes.get('total', 0):,} total downloads",
                "downloads": {
                    "total": attributes.get("total", 0),
                    "month": attributes.get("month", 0),
                    "week": attributes.get("week", 0)
                }
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting download summary: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to get download summary: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing download summary: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def registry_list_module_providers(
        self,
        namespace: str,
        name: str,
        limit: int = 15,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List all providers available for a specific module.
        
        Shows which cloud providers a module supports (aws, azure, gcp, etc.).
        Useful when you want the same module functionality across different clouds.
        
        Args:
            namespace: Module namespace/owner
            name: Module name
            limit: Maximum results to return
            offset: Pagination offset
            
        Returns:
            Dict with available providers and their details
            
        Example:
            registry_list_module_providers("hashicorp", "consul")
        """
        try:
            url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}")
            
            params = {
                'limit': min(limit, 50),
                'offset': max(offset, 0)
            }
            
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            modules = data.get("modules", [])
            
            processed_providers = []
            for module in modules:
                processed_providers.append({
                    "provider": module.get("provider", ""),
                    "latest_version": module.get("version", ""),
                    "description": module.get("description", "")[:100] + "..." if len(module.get("description", "")) > 100 else module.get("description", ""),
                    "downloads": module.get("downloads", 0),
                    "verified": module.get("verified", False),
                    "last_updated": module.get("published_at", "")[:10] if module.get("published_at") else ""
                })
            
            return {
                "success": True,
                "operation": "list_module_providers",
                "module": f"{namespace}/{name}",
                "message": f"Found {len(processed_providers)} providers",
                "provider_count": len(processed_providers),
                "providers": processed_providers
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error listing module providers: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to list providers: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing providers response: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        




















