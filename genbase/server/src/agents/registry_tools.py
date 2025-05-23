"""
Additional tools for working with the Terraform Registry API.
These tools allow the agent to search, discover, and analyze modules from the Terraform Registry.
"""
import requests
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urljoin, urlencode
import json
from ..logger import logger


class TerraformRegistryTools:
    """
    Tools for interacting with the Terraform Registry API
    """
    
    # Base URLs for different API versions
    BASE_URL_V1 = "https://registry.terraform.io/v1/modules/"
    BASE_URL_V2 = "https://registry.terraform.io/v2/modules/"
    
    def __init__(self, project_id: str, branch: str):
        """
        Initialize the TerraformRegistryTools
        
        Args:
            project_id: The project identifier (for consistency with other tools)
            branch: The branch (for consistency with other tools)
        """
        self.project_id = project_id
        self.branch = branch
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Genbase-Agent/1.0',
            'Accept': 'application/json'
        })
    
    def registry_list_modules(
        self,
        namespace: Optional[str] = None,
        provider: Optional[str] = None,
        verified: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List modules from the Terraform Registry.
        
        Args:
            namespace: Optional namespace to filter by (e.g., "hashicorp", "terraform-aws-modules")
            provider: Optional provider to filter by (e.g., "aws", "google", "azure")
            verified: If True, only return verified/partner modules
            limit: Maximum number of results to return (default: 20, max varies by endpoint)
            offset: Number of results to skip for pagination
            
        Returns:
            Dictionary with modules list and metadata
            
        Examples:
            # List all modules
            registry_list_modules()
            
            # List AWS modules from HashiCorp
            registry_list_modules(namespace="hashicorp", provider="aws")
            
            # List only verified modules
            registry_list_modules(verified=True, limit=10)
        """
        try:
            # Build URL
            if namespace:
                url = urljoin(self.BASE_URL_V1, f"{namespace}")
            else:
                url = self.BASE_URL_V1
            
            # Build query parameters
            params: Dict[str, Any] = {
                'limit': min(limit, 100),  # Reasonable maximum
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
            
            # Format response
            return {
                "success": True,
                "operation": "list_modules",
                "total_results": len(data.get("modules", [])),
                "modules": data.get("modules", []),
                "meta": data.get("meta", {}),
                "filters": {
                    "namespace": namespace,
                    "provider": provider,
                    "verified": verified
                },
                "message": f"Retrieved {len(data.get('modules', []))} modules from Terraform Registry"
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error listing modules from registry: {str(e)}")
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
    
    def registry_search_modules(
        self,
        query: str,
        provider: Optional[str] = None,
        namespace: Optional[str] = None,
        verified: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for modules in the Terraform Registry.
        
        Args:
            query: Search query string (keywords or phrases)
            provider: Optional provider to filter by (e.g., "aws", "google", "azure")  
            namespace: Optional namespace to filter by (e.g., "hashicorp")
            verified: If True, only return verified/partner modules
            limit: Maximum number of results to return (default: 20)
            offset: Number of results to skip for pagination
            
        Returns:
            Dictionary with search results and metadata
            
        Examples:
            # Search for VPC modules
            registry_search_modules("vpc")
            
            # Search for AWS networking modules
            registry_search_modules("network", provider="aws")
            
            # Search for verified security modules
            registry_search_modules("security", verified=True)
        """
        try:
            url = urljoin(self.BASE_URL_V1, "search")
            
            # Build query parameters
            params = {
                'q': query,
                'limit': min(limit, 100),
                'offset': max(offset, 0)
            }
            
            if provider:
                params['provider'] = provider
            if namespace:
                params['namespace'] = namespace
            if verified is not None:
                params['verified'] = str(verified).lower()
            
            # Make request
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                "success": True,
                "operation": "search_modules",
                "query": query,
                "total_results": len(data.get("modules", [])),
                "modules": data.get("modules", []),
                "meta": data.get("meta", {}),
                "filters": {
                    "provider": provider,
                    "namespace": namespace,
                    "verified": verified
                },
                "message": f"Found {len(data.get('modules', []))} modules matching '{query}'"
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
    
    def registry_get_module_versions(
        self,
        namespace: str,
        name: str,
        provider: str
    ) -> Dict[str, Any]:
        """
        Get all available versions for a specific module.
        
        Args:
            namespace: Module namespace/owner (e.g., "hashicorp", "terraform-aws-modules")
            name: Module name (e.g., "consul", "vpc")
            provider: Provider name (e.g., "aws", "google", "azurerm")
            
        Returns:
            Dictionary with version information and dependencies
            
        Examples:
            # Get versions for HashiCorp's AWS Consul module
            registry_get_module_versions("hashicorp", "consul", "aws")
            
            # Get versions for AWS VPC module
            registry_get_module_versions("terraform-aws-modules", "vpc", "aws")
        """
        try:
            url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/versions")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract version information
            modules = data.get("modules", [])
            if not modules:
                return {
                    "success": False,
                    "error": "Module not found in registry"
                }
            
            module_info = modules[0]
            versions = [v.get("version") for v in module_info.get("versions", [])]
            
            return {
                "success": True,
                "operation": "get_module_versions",
                "module": f"{namespace}/{name}/{provider}",
                "total_versions": len(versions),
                "versions": versions,
                "latest_version": versions[0] if versions else None,
                "source": module_info.get("source"),
                "dependencies": data.get("modules", [])[1:],  # Additional modules are dependencies
                "message": f"Found {len(versions)} versions for {namespace}/{name}/{provider}"
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
    
    def registry_get_module_details(
        self,
        namespace: str,
        name: str,
        provider: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed information about a specific module version.
        
        Args:
            namespace: Module namespace/owner (e.g., "hashicorp")
            name: Module name (e.g., "consul") 
            provider: Provider name (e.g., "aws")
            version: Specific version (if None, gets latest version)
            
        Returns:
            Dictionary with detailed module information including inputs, outputs, and submodules
            
        Examples:
            # Get latest version details
            registry_get_module_details("hashicorp", "consul", "aws")
            
            # Get specific version details
            registry_get_module_details("hashicorp", "consul", "aws", "0.7.3")
        """
        try:
            if version:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}/{version}")
            else:
                url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}/{provider}")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract key information
            root_module = data.get("root", {})
            submodules = data.get("submodules", [])
            
            # Process inputs and outputs for better readability
            inputs = []
            for inp in root_module.get("inputs", []):
                inputs.append({
                    "name": inp.get("name"),
                    "description": inp.get("description", ""),
                    "type": inp.get("type", ""),
                    "default": inp.get("default"),
                    "required": inp.get("default") == ""
                })
            
            outputs = []
            for out in root_module.get("outputs", []):
                outputs.append({
                    "name": out.get("name"),
                    "description": out.get("description", "")
                })
            
            # Process submodules
            processed_submodules = []
            for sub in submodules:
                processed_submodules.append({
                    "path": sub.get("path"),
                    "inputs": len(sub.get("inputs", [])),
                    "outputs": len(sub.get("outputs", [])),
                    "resources": len(sub.get("resources", []))
                })
            
            return {
                "success": True,
                "operation": "get_module_details", 
                "module": f"{namespace}/{name}/{provider}",
                "version": data.get("version"),
                "description": data.get("description", ""),
                "source": data.get("source", ""),
                "verified": data.get("verified", False),
                "downloads": data.get("downloads", 0),
                "published_at": data.get("published_at", ""),
                "providers": data.get("providers", []),
                "inputs": inputs,
                "outputs": outputs, 
                "input_count": len(inputs),
                "output_count": len(outputs),
                "submodules": processed_submodules,
                "submodule_count": len(processed_submodules),
                "readme": root_module.get("readme", "")[:500] + "..." if len(root_module.get("readme", "")) > 500 else root_module.get("readme", ""),
                "message": f"Retrieved details for {namespace}/{name}/{provider}" + (f" v{data.get('version')}" if data.get('version') else "")
            }
            
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
    
    def registry_get_module_download_info(
        self,
        namespace: str,
        name: str,
        provider: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get download information for a module (returns download URL).
        
        Args:
            namespace: Module namespace/owner
            name: Module name
            provider: Provider name
            version: Specific version (if None, gets latest)
            
        Returns:
            Dictionary with download information
            
        Examples:
            # Get download info for latest version
            registry_get_module_download_info("hashicorp", "consul", "aws")
            
            # Get download info for specific version  
            registry_get_module_download_info("hashicorp", "consul", "aws", "0.7.3")
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
                    "download_url": download_url,
                    "status_code": response.status_code,
                    "message": f"Download URL retrieved for {namespace}/{name}/{provider}"
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
    
    def registry_get_module_downloads_summary(
        self,
        namespace: str,
        name: str,
        provider: str
    ) -> Dict[str, Any]:
        """
        Get download metrics summary for a module (uses v2 API).
        
        Args:
            namespace: Module namespace/owner
            name: Module name 
            provider: Provider name
            
        Returns:
            Dictionary with download statistics
            
        Examples:
            # Get download stats
            registry_get_module_downloads_summary("hashicorp", "consul", "aws")
        """
        try:
            url = urljoin(self.BASE_URL_V2, f"{namespace}/{name}/{provider}/downloads/summary")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract metrics from v2 API format
            attributes = data.get("data", {}).get("attributes", {})
            
            return {
                "success": True,
                "operation": "get_module_downloads_summary",
                "module": f"{namespace}/{name}/{provider}",
                "downloads": {
                    "week": attributes.get("week", 0),
                    "month": attributes.get("month", 0), 
                    "year": attributes.get("year", 0),
                    "total": attributes.get("total", 0)
                },
                "message": f"Download stats: {attributes.get('total', 0)} total downloads"
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
    
    def registry_list_module_providers(
        self,
        namespace: str,
        name: str,
        limit: int = 15,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List all providers available for a specific module.
        
        Args:
            namespace: Module namespace/owner
            name: Module name
            limit: Maximum results to return
            offset: Pagination offset
            
        Returns:
            Dictionary with available providers for the module
            
        Examples:
            # List all providers for consul module
            registry_list_module_providers("hashicorp", "consul")
        """
        try:
            url = urljoin(self.BASE_URL_V1, f"{namespace}/{name}")
            
            params = {
                'limit': min(limit, 100),
                'offset': max(offset, 0)
            }
            
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            modules = data.get("modules", [])
            providers = []
            
            for module in modules:
                providers.append({
                    "provider": module.get("provider"),
                    "version": module.get("version"),
                    "description": module.get("description", ""),
                    "downloads": module.get("downloads", 0),
                    "verified": module.get("verified", False),
                    "published_at": module.get("published_at", "")
                })
            
            return {
                "success": True,
                "operation": "list_module_providers",
                "module": f"{namespace}/{name}",
                "provider_count": len(providers),
                "providers": providers,
                "meta": data.get("meta", {}),
                "message": f"Found {len(providers)} providers for {namespace}/{name}"
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
    
    def registry_recommend_modules(
        self,
        use_case: str,
        provider: Optional[str] = None,
        verified_only: bool = True,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Recommend modules based on a use case description.
        This combines search with filtering to provide relevant suggestions.
        
        Args:
            use_case: Description of what you want to build (e.g., "web application with database")
            provider: Optional provider preference (e.g., "aws")
            verified_only: Whether to only return verified modules
            limit: Maximum number of recommendations
            
        Returns:
            Dictionary with recommended modules
            
        Examples:
            # Get recommendations for building a web app
            registry_recommend_modules("web application load balancer", provider="aws")
            
            # Get recommendations for database setup
            registry_recommend_modules("postgresql database", verified_only=True)
        """
        try:
            # Extract keywords from use case for better search
            search_terms = use_case.lower()
            
            # Perform search
            search_result = self.registry_search_modules(
                query=search_terms,
                provider=provider,
                verified=verified_only,
                limit=limit * 2  # Get more results to filter better
            )
            
            if not search_result.get("success"):
                return search_result
            
            modules = search_result.get("modules", [])
            
            # Score and rank modules based on relevance
            scored_modules = []
            for module in modules:
                score = 0
                description = (module.get("description", "") + " " + module.get("name", "")).lower()
                
                # Simple scoring based on keyword matches
                for word in search_terms.split():
                    if word in description:
                        score += 1
                
                # Boost score for verified modules
                if module.get("verified"):
                    score += 2
                
                # Boost score for high download count
                downloads = module.get("downloads", 0)
                if downloads > 1000:
                    score += 1
                if downloads > 10000:
                    score += 1
                
                scored_modules.append({
                    **module,
                    "relevance_score": score
                })
            
            # Sort by score and limit results
            scored_modules.sort(key=lambda x: x["relevance_score"], reverse=True)
            recommendations = scored_modules[:limit]
            
            return {
                "success": True,
                "operation": "recommend_modules",
                "use_case": use_case,
                "total_recommendations": len(recommendations),
                "recommendations": recommendations,
                "filters": {
                    "provider": provider,
                    "verified_only": verified_only
                },
                "message": f"Found {len(recommendations)} recommended modules for '{use_case}'"
            }
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }